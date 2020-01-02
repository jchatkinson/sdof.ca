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
  plotOptions = [{name: "Excitation", val: 0},{name: "Response Spectrum", val: 1},{name: "Acceleration", val: 2},{name: "Velocity", val: 3},{name: "Displacement", val: 4}];
  plotData = [{name: 'Excitation', x:[0,1,2], y:[0,1,2], type:'scatter', mode:'lines+points', marker:{color: 'teal'}}];
  plotLayout = {autosize: true, margin: {l:20, r:0, t:0, b:20}};
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
          this.data.series[2] = result.a;
          this.data.series[3] = result.v;
          this.data.series[4] = result.u;
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
      this.data.excitetime = 40;
      this.data.totaltime = 60;
      this.data.scalefactor = 9.81;      
    }
  }

  debug() {
    console.log('data:\n:',this.data);
    console.log('plotData:\n',this.plotData);
  }

}
