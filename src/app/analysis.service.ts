import { Injectable } from '@angular/core';
import { HttpClient, HttpRequest } from '@angular/common/http';
import { Observable, AsyncSubject } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class AnalysisService {
	functionTypes: IAnalysisFunction[] = [
		{ name: 'sine', fullname: 'Sine Wave', type: 'Harmonic', note: '' },
		{ name: 'saw', fullname: 'Sawtooth Wave', type: 'Harmonic', note: '' },
		{ name: 'square', fullname: 'Square Wave', type: 'Harmonic', note: '' },
		{ name: 'rampup', fullname: 'Ramp Up', type: 'Impulse', note: '' },
		{ name: 'rampdn', fullname: 'Ramp Down', type: 'Impulse', note: '' },
		{ name: 'acc', fullname: 'File Containing Accelerations', type: 'From File', note: 'Note: The file must formatted such that each row contains <code>[acceleration]</code> at a constant time interval' },
		{ name: 'timeacc', fullname: 'File Containing Time and Acceleration', type: 'From File', note: 'Note: The file must formatted such that each row contains <code>[time,acceleration]</code>' },
		{ name: 'peernga', fullname: 'PEER NGA File', type: 'From File', note: 'Note: The file must formatted as an unaltered <a class="block underline" href="http://ngawest2.berkeley.edu/" target="_blank">PEER NGA Record</a>' },
		{ name: 'kobe', fullname: 'Kobe (1995)', type: 'Ground Motion', note: 'This is an unscaled ground motion from the 1995 Kobe Earthquake, Kakokawa Station, 000 Component' }
	];
	kobe: IData[];

	data: IAnalysisData = {
		period: 0.5,
		damp: 5,
		fid: 0,
		func: this.functionTypes[0],
		funcperiod: 0.4,
		amp: 10,
		dt: 0.02,
		excitetime: 5,
		totaltime: 15,
		scalefactor: 9.81,
		vshift: 0,
		hshift: 0,
		yaxis: 0,
		// series: [excitation, acc, vel, disp, ars, vrs, drs]
		series: [[{ x: 0, y: 0 }], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }]],
		rawfile: [],
		procfile: [],
	};

	constructor(private http: HttpClient) {
		this.data.series[0] = this.createTimeSeries(this.data)
		this.loadJSON();
	}

	loadJSON() {
		this.http.get('/assets/kobe.json').subscribe((res:IData[]) => {
			this.kobe = res;
		});
	};

	getFunctionType(fid?: number) {
		if (fid) {
			return this.functionTypes[fid]
		} else {
			return this.functionTypes;
		}
	};

	getData(field?: string) {
		if (field) {
			return this.data[field]
		} else {
			return Object.assign({}, this.data);
		}
	}

	// function to process a user input text file
	processTextFile(inputFile: File): Observable<{ raw: any, processed: any }> {
		console.log('processing file', inputFile);
		let fileReader = new FileReader();
		let fileData: { raw: any, processed: any } = { raw: null, processed: null };
		let result = new AsyncSubject<{ raw: any, processed: any }>();
		fileReader.onloadend = () => {
			let vals, procfile = [];
			let rawfile = fileReader.result.toString();
			fileData.raw = rawfile;
			rawfile = rawfile.replace(/\s\./g, "0.");
			let lines = rawfile.split(/\n/);
			var patt = new RegExp(/[A-z]{2,}/);
			lines.forEach(line => {
				if (!patt.test(line)) { //line doesn't contain text
					vals = line.split(/[\s,;\t]+/);
					procfile.push(...vals);
				}
			})
			//remove any empty strings
			for (let line = 0; line < procfile.length; line++) {
				if (procfile[line] === "") {
					procfile.splice(line, 1);
					line--;
				};
			};
			//convert array elements from strings to numbers
			procfile = procfile.map(Number);

			fileData.processed = procfile;
			result.next(fileData)
			result.complete();
		}
		fileReader.readAsText(inputFile);
		return result;
	}

	// function to create the analysis time series
	createTimeSeries(data: IAnalysisData) {
		if (Math.min(data.dt, data.funcperiod, data.excitetime) <= 0.0) {
			return [{ x: 0, y: 0 }];
		};
		let npts = Math.ceil(data.excitetime / data.dt);
		let series = [];

		if (npts > 100000) {
			return [{ x: 0, y: 0 }];
		};

		switch (data.func.name) {
			case 'sine':
				var eqn = function (data: IAnalysisData, t: number) {
					return data.amp * Math.sin(2 * Math.PI / data.funcperiod * (t + data.hshift)) + data.vshift;
				}
				break;
			case 'saw':
				var eqn = function (data: IAnalysisData, t: number) {
					return -2 * data.amp / Math.PI * Math.atan(1 / Math.tan((t + data.hshift) * Math.PI / data.funcperiod)) + data.vshift;
				}
				break;
			case 'square':
				var eqn = function (data: IAnalysisData, t: number) {
					return data.amp * (2 * Math.floor((t + data.hshift) / data.funcperiod) - Math.floor(2 * (t + data.hshift) / data.funcperiod) + 1) + data.vshift - 0.5*data.amp;
				}
				break;
			case 'rampup':
				var eqn = function (data: IAnalysisData, t: number) {
					if (t <= data.excitetime) {
						return data.amp * t / data.excitetime;
					} else {
						return 0;
					};
				}
				break;
			case 'rampdn':
				var eqn = function (data: IAnalysisData, t: number) {
					if (t <= data.excitetime) {
						return data.amp - data.amp * t / data.excitetime;
					} else {
						return 0;
					};
				}
				break;
			case 'acc': //data.procfile is array of acc values [a1,a2,a3,...]
				var eqn = function (data: IAnalysisData, t: number) {
					if (data.procfile.length > 0 && t <= data.excitetime && t <= data.dt * (data.procfile.length - 1)) {
						return data.scalefactor * data.procfile[Math.round(t / data.dt)];
					} else {
						return 0;
					};
				}
				break;
			case 'timeacc': //data.procfile is array of [t1,a1,t2,a2,..]
				var eqn = function (data: IAnalysisData, t: number) {
					if (data.procfile.length > 0 && t <= data.excitetime && t <= data.procfile[data.procfile.length - 1]) {
						//time could be unevenly spaced, so need to interp values
						var times = data.procfile;
						var accs = times;
						for (var ind = 0; ind < times.length; ind++) {
							times.splice(i, 1);
							accs.splice(i + 1, 1);
						};
						//find index of times array corresponding to t
						var min = Math.abs(times[0] - t);
						var i1 = 0;
						var i2 = 0;
						for (var i = 1; i < times.length; i++) {
							if (Math.abs(times[i] - t) < min) {
								i1 = i;
								if (times[i] > t) { i2 = i - 1; } else { i2 = i + 1; };
								min = Math.abs(times[i] - t);
							};
						};
						var ag = (accs[i1] - accs[i2]) * (t - times[i2]) / (times[i1] - times[i2]) + accs[i2];
						return data.scalefactor * ag;
					} else {
						return 0;
					};
				}
				break;
			case 'peernga': //procfile is string of acc values [a1,a2,a3,...]
				var eqn = function (data: IAnalysisData, t: number) {
					if (data.procfile.length > 0 && t <= data.excitetime && t <= data.dt * (data.procfile.length - 1)) {
						return data.scalefactor * data.procfile[Math.round(t / data.dt)];
					} else {
						return 0;
					};
				}
			case 'kobe':
				let acc = this.kobe.map(d => d.y/9.81);
				let time = this.kobe.map(d => d.x);
				var eqn = function (data: IAnalysisData, t: number) {				
					if (t <= time[time.length-1]) {
						return data.scalefactor * acc[Math.round(t/data.dt)];
					} else {
						return 0;
					};
				};
			break;
		};

		let yt = 0.0;
		let i: number, t: number;
		for (i = 0; i < npts; i++) {
			t = i * data.dt;
			yt = eqn(data, t);
			series.push({
				x: t,
				y: yt
			});
		}
		//add additional points of zeros if eTotalTime > eExciteTime
		if (data.totaltime > data.excitetime) {
			for (i = npts; i < npts + Math.ceil((data.totaltime - data.excitetime) / data.dt); i++) {
				t = i * data.dt;
				series.push({
					x: t,
					y: 0.0
				});
			}
		};
		return series;
	};

	// calculateFFT(signal: IData[]) {
	// 	//pad the data to the next pow(2)
	// 	const power = Math.ceil(Math.log2(signal.length));
	// 	const npts = Math.pow(2, power);
	// 	const f = new FFT(npts);
	// 	let zeros = new Array(f.size)
	// 	zeros.fill(0);
	// 	let signaldata = signal.map(a => a.y);
	// 	zeros.splice(0, signaldata.length, ...signaldata);

	// 	const output = f.createComplexArray();
	// 	f.realTransform(output, zeros);
	// 	f.completeSpectrum(output);
	// 	console.log(f, output)
	// }

	analyze(T: number, zeta: number, ag: any[], dt: number, ttotal: number): ({ u: IData[], a: IData[], v: IData[] }) {
		zeta = zeta / 100.0
		if (dt === 0) {
			console.warn('dt is zero! Nothing to calculate');
			return { u: [{ x: 0, y: 0 }], a: [{ x: 0, y: 0 }], v: [{ x: 0, y: 0 }] };
		}
		if (ttotal / dt > 100000) {
			console.warn('Too many points! Skipping calculation to avoid stackoverflow');
			return { u: [{ x: 0, y: 0 }], a: [{ x: 0, y: 0 }], v: [{ x: 0, y: 0 }] };
		}
		var t = 0;
		var npts_ag = ag.length;
		var npts_total = Math.ceil(ttotal / dt);
		var w = 2 * Math.PI / T;
		var m = 1000;
		var k = w * w * m;
		var wd = w * Math.sqrt(1.0 - zeta * zeta);
		var e = Math.exp(-zeta * w * dt);
		var s = Math.sin(wd * dt);
		var c = Math.cos(wd * dt);
		//set inital conditions
		var u = [{ x: 0, y: 0 }];
		var v = [{ x: 0, y: 0 }];
		var pr = [{ x: 0, y: k * u[0].y }];
		var y0 = -ag[0] - 2.0 * zeta * w * v[0].y - pr[0].y / m;
		var a = [{ x: 0, y: y0 }];
		//recurrence formula coefficiencts
		var A = e * (zeta / Math.sqrt(1.0 - zeta * zeta) * s + c);
		var B = e * (1.0 / wd * s);
		var C = -1.0 / (w * w) * (2.0 * zeta / (w * dt) + e * (((1.0 - 2.0 * zeta * zeta) / (wd * dt) - zeta / Math.sqrt(1.0 - zeta * zeta)) * s - (1.0 + 2.0 * zeta / (w * dt)) * c));
		var D = -1.0 / (w * w) * (1.0 - 2.0 * zeta / (w * dt) + e * ((2.0 * zeta * zeta - 1.0) / (wd * dt) * s + 2.0 * zeta / (w * dt) * c));
		var Ap = -e * (w / Math.sqrt(1.0 - zeta * zeta) * s);
		var Bp = e * (c - zeta / Math.sqrt(1.0 - zeta * zeta) * s);
		var Cp = -1.0 / (w * w) * (-1.0 / dt + e * ((w / Math.sqrt(1.0 - zeta * zeta) + zeta / (dt * Math.sqrt(1.0 - zeta * zeta))) * s + 1.0 / dt * c));
		var Dp = -1.0 / (w * w * dt) * (1.0 - e * (zeta / Math.sqrt(1.0 - zeta * zeta) * s + c));

		//loop through each steps
		let i: number, agi: number, agip1: number;
		for (i = 0; i < npts_total - 1; i++) {
			agi = (i < npts_ag) ? ag[i] : 0.0;
			agip1 = (i < npts_ag - 1) ? ag[i + 1] : 0.0;
			t = i * dt;
			u.push({ x: t, y: A * u[i].y + B * v[i].y + C * agi + D * agip1 });
			v.push({ x: t, y: Ap * u[i].y + Bp * v[i].y + Cp * agi + Dp * agip1 });
			pr.push({ x: t, y: k * u[i + 1].y });
			a.push({ x: t, y: -agip1 - 2.0 * zeta * w * v[i + 1].y - pr[i + 1].y / m });
		};
		return {
			u: u,
			v: v,
			a: a
		};
	}

	responsespectrum(signal: IData[], zeta: number, Tmin: number, Tmax: number, npts: number): ({ ARS: IData[], VRS: IData[], DRS: IData[] }) {
		const ag = signal.map(a => a.y);
		const dt = signal[1].x - signal[0].x;
		const ttotal = signal[signal.length - 1].x + Tmax * 2;
		const fmax = 1 / Tmin, fmin = 1 / Tmax;
		const qv = Math.pow(fmax / fmin, 1 / npts);
		let result: { u: number; a: number; v: number; }, T = 0;
		let ARS: IData[] = [], VRS: IData[] = [], DRS: IData[] = [];
		if (dt === 0) {
			console.warn('dt is zero! Nothing to calculate');
			return { ARS: ARS, VRS: VRS, DRS: DRS };
		}
		if (ttotal / dt > 100000) {
			console.warn('Too many points! Skipping calculation to avoid stackoverflow');
			return { ARS: ARS, VRS: VRS, DRS: DRS };
		}
		for (let ii = 0; ii < npts; ii++) {
			T = 1 / (fmin * Math.pow(qv, ii));
			result = this.analyzeForMax(T, zeta, ag, dt, ttotal);
			ARS.push({ x: T, y: result.a });
			DRS.push({ x: T, y: result.u });
			VRS.push({ x: T, y: result.v });
		}
		return { ARS: ARS, VRS: VRS, DRS: DRS }
	};

	analyzeForMax(T: number, zeta: number, ag: any[], dt: number, ttotal: number): ({ u: number, a: number, v: number }) {
		zeta = zeta / 100.0
		if (dt === 0) {
			return { u: 0, a: 0, v: 0 };
		}
		if (ttotal / dt > 100000) {
			return { u: 0, a: 0, v: 0 };
		}
		var t = 0;
		var npts_ag = ag.length;
		var npts_total = Math.ceil(ttotal / dt);
		var w = 2 * Math.PI / T;
		var m = 1000;
		var k = w * w * m;
		var wd = w * Math.sqrt(1.0 - zeta * zeta);
		var e = Math.exp(-zeta * w * dt);
		var s = Math.sin(wd * dt);
		var c = Math.cos(wd * dt);
		//set inital conditions
		var u = [0];
		var v = [0];
		var pr = [k * u[0]];
		var y0 = -ag[0] - 2.0 * zeta * w * v[0] - pr[0] / m;
		var a = [y0];
		//recurrence formula coefficiencts
		var A = e * (zeta / Math.sqrt(1.0 - zeta * zeta) * s + c);
		var B = e * (1.0 / wd * s);
		var C = -1.0 / (w * w) * (2.0 * zeta / (w * dt) + e * (((1.0 - 2.0 * zeta * zeta) / (wd * dt) - zeta / Math.sqrt(1.0 - zeta * zeta)) * s - (1.0 + 2.0 * zeta / (w * dt)) * c));
		var D = -1.0 / (w * w) * (1.0 - 2.0 * zeta / (w * dt) + e * ((2.0 * zeta * zeta - 1.0) / (wd * dt) * s + 2.0 * zeta / (w * dt) * c));
		var Ap = -e * (w / Math.sqrt(1.0 - zeta * zeta) * s);
		var Bp = e * (c - zeta / Math.sqrt(1.0 - zeta * zeta) * s);
		var Cp = -1.0 / (w * w) * (-1.0 / dt + e * ((w / Math.sqrt(1.0 - zeta * zeta) + zeta / (dt * Math.sqrt(1.0 - zeta * zeta))) * s + 1.0 / dt * c));
		var Dp = -1.0 / (w * w * dt) * (1.0 - e * (zeta / Math.sqrt(1.0 - zeta * zeta) * s + c));

		//loop through each steps
		let i: number, agi: number, agip1: number;
		for (i = 0; i < npts_total - 1; i++) {
			agi = (i < npts_ag) ? ag[i] : 0.0;
			agip1 = (i < npts_ag - 1) ? ag[i + 1] : 0.0;
			t = i * dt;
			u.push(A * u[i] + B * v[i] + C * agi + D * agip1);
			v.push(Ap * u[i] + Bp * v[i] + Cp * agi + Dp * agip1);
			pr.push(k * u[i + 1]);
			a.push(-agip1 - 2.0 * zeta * w * v[i + 1] - pr[i + 1] / m);
		};
		return {
			u: Math.max(Math.max(...u), Math.abs(Math.min(...u))),
			v: Math.max(Math.max(...v), Math.abs(Math.min(...v))),
			a: Math.max(Math.max(...a), Math.abs(Math.min(...a)))
		};
	};
}

export interface IData {
	x: number;
	y: number;
}

export interface IAnalysisFunction {
	name: string;
	fullname: string;
	type: string;
	note: string;
}

export interface IAnalysisData {
	period: number;
	damp: number;
	fid: number;
	func: IAnalysisFunction;
	funcperiod?: number;
	totaltime: number;
	excitetime: number;
	dt?: number;
	amp?: number;
	scalefactor?: number;
	vshift?: number;
	hshift?: number;
	series: IData[][];
	response?: any[];
	rawfile?: any;
	procfile?: any;
	file?: any;
	npts?: number;
	yaxis: number;
}

export interface IPlotData {
	name: string,
	x: number[],
	y: number[],
	type: string,
	mode?: string,
	marker?: { color: string }
}
