import { Component, OnInit, ViewChild, AfterContentInit, OnDestroy } from '@angular/core';
import { AnalysisService, IAnalysisData, IData, IPlotData } from '../analysis.service';
import { NgForm } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-tool',
  templateUrl: './tool.component.html',
  styles: []
})
export class ToolComponent implements OnInit, AfterContentInit, OnDestroy {
  @ViewChild('myform', {static:true}) myform: NgForm;
  @ViewChild('plotControl', {static:true}) plotControl: NgForm;
  showModalData = false;
  functionTypes: any;
  plotOptions = [{name: "Excitation", val: 0},{name: "Acceleration", val: 1},{name: "Velocity", val: 2},{name: "Displacement", val: 3},{name: "Acceleration Response Spectrum", val: 4},{name: "Velocity Response Spectrum", val: 5},{name: "Displacement Response Spectrum", val: 6}];
  plotData = [{name: 'Excitation', x:[0], y:[0], type:'scatter', mode:'lines+points', marker:{color: 'teal'}}];
  plotLayout = {autosize: true, margin: {l:24, r:0, t:0, b:24}};
  data: IAnalysisData;
  $subs: Subscription[] = [];
  
  constructor(private as: AnalysisService) {
    this.as = as;
   }

  ngOnInit() {
    this.functionTypes = this.as.getFunctionType();
    this.data = this.as.getData();
    this.updatePlot(this.plotOptions[this.data.yaxis].name, this.data.series[this.data.yaxis]);
  }

  ngAfterContentInit() {
    this.$subs.push(this.myform.form.valueChanges.pipe(debounceTime(250)).subscribe(change => {
      // recalculate derived properties
      if (this.data.dt <= 0) {
        console.warn('dt needs to be greater than zero');
      } else {
        if (this.myform.valid) {
          this.data.series[0] = this.as.createTimeSeries(this.data);
          let result = this.as.analyze(this.data.period, this.data.damp, this.data.series[0].map(pt=>pt.y), this.data.dt, this.data.totaltime);
          this.data.series[1] = result.a;
          this.data.series[2] = result.v;
          this.data.series[3] = result.u;
          let spectra = this.as.responsespectrum(this.data.series[0], this.data.damp, 0.01, 10, 128);
          this.data.series[4] = spectra.ARS;
          this.data.series[5] = spectra.VRS;
          this.data.series[6] = spectra.DRS;
          this.updatePlot(this.plotOptions[this.data.yaxis].name, this.data.series[this.data.yaxis]);
        }
      }
    }));
  };

  ngOnDestroy() {
    this.$subs.forEach(s => s.unsubscribe());
  }

  handleError(err) {
    console.error(err);
  }
  handleChange(change) {
    console.log(change);
  }
  handleSelectChange() {
    this.updatePlot(this.plotOptions[this.data.yaxis].name, this.data.series[this.data.yaxis]);
  };
  handleTextFile($event){
    this.as.processTextFile($event.target.files[0]).subscribe(result=>{
      this.data.procfile = result.processed;
      this.data.rawfile = result.raw;
      this.data.series[0] = this.as.createTimeSeries(this.data);
      this.updatePlot(this.plotOptions[this.data.yaxis].name, this.data.series[this.data.yaxis]);
    });
  }
  resetForm(){
    let initalData: IAnalysisData = this.as.getData();
    console.log(initalData)
    Object.assign(this.data, initalData);
    // this.updatePlot(this.plotOptions[this.data.yaxis].name, this.data.series[this.data.yaxis]);
  }

  updatePlot(name:string, newdata: IData[]) {
    this.plotData = [{
      name: name,
      x: newdata.map(pt=>pt.x),
      y: newdata.map(pt=>pt.y),
      type: 'scatter', 
      mode: 'lines+points', 
      marker: {color: 'teal'}
    }];
  };

  functionChange(id: number) {
    this.data.func = this.functionTypes[id];
    if (id===8) {
      this.data.dt = 0.01;
      this.data.excitetime = 41;
      this.data.totaltime = 60;
      this.data.scalefactor = 9.81;      
    }
  }

  calculateFFT() {
    // this.as.calculateFFT(this.data.series[0]);
    let spectra = this.as.responsespectrum(this.data.series[0], this.data.damp, 0.01, 10, 128);
    this.data.series[1] = spectra.ARS;
    console.log(spectra);
  }

  debug() {
    console.log('data:\n:',this.data);
    console.log('plotData:\n',this.plotData);
  }

}
