import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {
  functionTypes: IAnalysisFunction[] = [
    {name:'sine', fullname:'Sine Wave',type:'Harmonic',note:''},
    {name:'saw', fullname:'Sawtooth Wave',type:'Harmonic',note:''},
    {name:'square', fullname:'Square Wave',type:'Harmonic',note:''},
    {name:'rampup', fullname:'Ramp Up',type:'Impulse',note:''},
    {name:'rampdn', fullname:'Ramp Down',type:'Impulse',note:''},
    {name:'acc',fullname:'File Containing Accelerations',type:'From File',note:'Note: The file must formatted such that each row contains <code>[acceleration]</code> at a constant time interval'},
    {name:'timeacc',fullname:'File Containing Time and Acceleration',type:'From File',note:'Note: The file must formatted such that each row contains <code>[time,acceleration]</code>'},
    {name:'peernga',fullname:'PEER NGA File',type:'From File',note:'Note: The file must formatted as an unaltered <a class="block underline" href="http://ngawest2.berkeley.edu/" target="_blank">PEER NGA Record</a>'}
  ];
  data: IAnalysisData = {
    period: 0.5, 
    damp: 5, 
    func: this.functionTypes[0], 
    funcperiod: 0.4, 
    amp: 10,
    dt: 0.02,
    excitetime: 5, 
    totaltime: 15, 
    scalefactor: 9.81, 
    vshift: 0, 
    hshift: 0
  };

  constructor() { 
    this.data.series = this.createTimeSeries(this.data)
  }

  getFunctionTypes() {
    return this.functionTypes;
  }
  getData(field?: string) {
    if (field) {
      return this.data[field]
    } else {
      return this.data;
    }
  }

  // function to create the analysis time series
  createTimeSeries(data: IAnalysisData) {
		let npts = Math.ceil(data.excitetime / data.dt);
    let series = [];
    
		switch(data.func.name) {
			case 'sine':
				var eqn = function(data: IAnalysisData, t: number){
					return data.amp*Math.sin(2*Math.PI/data.funcperiod*(t+data.hshift))+data.vshift;
				} 
				break;
			case 'saw':
				var eqn = function(data: IAnalysisData, t: number){
					return -2*data.amp/Math.PI*Math.atan( 1/Math.tan( ( t+data.hshift )*Math.PI/data.funcperiod ) ) + data.vshift;
				} 
				break;
			case 'square':
				var eqn = function(data: IAnalysisData, t: number){
					return data.amp*( 2*Math.floor((t+data.hshift)/data.funcperiod) - Math.floor(2*(t+data.hshift)/data.funcperiod) + 1 )+data.vshift;
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
					if (data.procfile.length > 0 && t <= data.excitetime && t<=data.dt*data.procfile.length) {
						return data.scalefactor*data.procfile[Math.round(t / data.dt)];
					} else {
						return 0;
					};
				}				
				break;
			case 'timeacc': //data.procfile is array of [t1,a1,t2,a2,..]
				var eqn = function (data: IAnalysisData, t: number) { 
					if (data.procfile.length > 0 &&  t <= data.excitetime && t<=data.procfile[data.procfile.length-1]) {
						//time could be unevenly spaced, so need to interp values
						var times = data.procfile; 
						var accs = times;
						for(var ind=0; ind<times.length; ind++){ 
							times.splice(i,1); 
							accs.splice(i+1,1); 
						};
						//find index of times array corresponding to t
						var min = Math.abs(times[0]-t);
						var i1 = 0;
						var i2 = 0;
						for (var i = 1; i < times.length; i++) {
						    if (Math.abs(times[i]-t) < min) {
						        i1 = i;
						        if(times[i] > t){ i2 = i-1; } else{ i2 = i+1; };
						        min = Math.abs(times[i]-t);
						    };
						};			
						var ag = (accs[i1] - accs[i2]) * (t - times[i2]) / (times[i1] - times[i2]) + accs[i2];							
						return data.scalefactor*ag;
					} else {
						return 0;
					};
				}				
				break;
			case 'peernga': //procfile is string of acc values [a1,a2,a3,...]
				var eqn = function (data: IAnalysisData, t: number) { 
					if (data.procfile.length > 0 && t <= data.excitetime && t<=data.dt*data.procfile.length) {
						return data.scalefactor*data.procfile[Math.round(t / data.dt)];
					} else {
						return 0;
					};
				}				
				break;			
			}; 
		let yt=0.0;
		let i: number, t: number;
		for (i=0; i<npts-1; i++) {
			t=i*data.dt;
			yt = eqn(data,t);
			series.push({
				x:t,
				y:yt
			}); 			
		}
		//add additional points of zeros if eTotalTime > eExciteTime
		if (data.totaltime > data.excitetime) {
			for (i=npts; i<npts+Math.ceil((data.totaltime - data.excitetime)/data.dt); i++) {
				t=i*data.dt;
				series.push({
					x:t,
					y:0.0
				}); 			
			}	
		};
		return series;
  };
  
  analyze(T: number, zeta: number, ag: any[], dt: number, ttotal: number): ({u: IData[], a:IData[], v:IData[]}){
    		//check if zeta is in decimal or percent notation
		if (zeta > 1.0) {
			zeta = zeta/100.0
		};
		var t = 0;
		var npts_ag = ag.length;
		var npts_total = Math.ceil(ttotal/dt);
		var w = 2*Math.PI/T;
		var m=1000; 
		var k = w*w*m;
		var wd = w*Math.sqrt(1.0-zeta*zeta);
		var e = Math.exp(-zeta*w*dt);
		var s = Math.sin(wd*dt);
		var c = Math.cos(wd*dt);
		//set inital conditions
		var u=[{x:0,y:0}];
		var v=[{x:0,y:0}];
		var pr = [{x:0,y: k*u[0].y}];
		var y0 = -ag[0].y - 2.0*zeta*w*v[0].y - pr[0].y/m;
		var a=[{x:0,y:y0}];
		//recurrence formula coefficiencts
		var A  = e*(zeta/Math.sqrt(1.0-zeta*zeta)*s + c);
    var B  = e*(1.0/wd*s);
    var C  = -1.0/(w*w)*(2.0*zeta/(w*dt) + e*(((1.0-2.0*zeta*zeta)/(wd*dt) - zeta/Math.sqrt(1.0-zeta*zeta))*s - (1.0+2.0*zeta/(w*dt))*c));
    var D  = -1.0/(w*w)*(1.0-2.0*zeta/(w*dt) + e*((2.0*zeta*zeta-1.0)/(wd*dt)*s + 2.0*zeta/(w*dt)*c));
    var Ap = -e*(w/Math.sqrt(1.0-zeta*zeta)*s);
    var Bp = e*(c-zeta/Math.sqrt(1.0-zeta*zeta)*s);
    var Cp = -1.0/(w*w)*(-1.0/dt + e*((w/Math.sqrt(1.0-zeta*zeta) + zeta/(dt*Math.sqrt(1.0-zeta*zeta)))*s + 1.0/dt*c));
    var Dp = -1.0/(w*w*dt)*(1.0 - e*(zeta/Math.sqrt(1.0-zeta*zeta)*s+c));
    	//loop through each steps
    let i: number, agi: number, agip1: number;
    	for (i=0; i<npts_total-1; i++) {
    		agi = (i<npts_ag) ? ag[i].y : 0.0;
        	agip1 = (i<npts_ag-1) ? ag[i+1].y : 0.0;
        	t = i*dt;
        	u.push({x:t, y: A * u[i].y + B * v[i].y + C * agi + D * agip1});
        	v.push({x:t,y:Ap * u[i].y + Bp * v[i].y + Cp * agi + Dp * agip1});
			pr.push({x:t,y:k*u[i+1].y}); 
			a.push({x:t,y:-agip1 - 2.0*zeta*w*v[i+1].y - pr[i+1].y/m});
    	};
		return {
			u: u,		
			v: v,
			a: a
		};
  }
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
  func: IAnalysisFunction;
  funcperiod?: number;
  totaltime: number;
  excitetime: number;
  dt?: number;
  amp?: number;
  scalefactor?: number;
  vshift?: number;
  hshift?: number;
  series?: IData[];
  response?: any[];
  rawfile?: any;
  procfile?: any;
  npts?: number;
}
