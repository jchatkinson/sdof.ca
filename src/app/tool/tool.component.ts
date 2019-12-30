import { Component, OnInit, ViewChild, AfterContentInit } from '@angular/core';
import { AnalysisService, IAnalysisData } from '../analysis.service';
import { NgForm } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-tool',
  templateUrl: './tool.component.html',
  styles: []
})
export class ToolComponent implements OnInit, AfterContentInit {
  @ViewChild('systemForm', {static:true}) systemForm: NgForm;
  @ViewChild('exciteForm', {static:true}) exciteForm: NgForm;

  functionTypes: any[];
  plotOptions = [{name: "Excitation"},{name: "Response Spectrum"},{name: "Acceleration"},{name: "Velocity"},{name: "Displacement"}];
  plotData = [{ x: [], y: [], type: 'scatter', mode: 'lines+points', marker: {color: 'teal'} }];
  plotLayout = {autosize: true, title: 'Input Excitation'};
  data: IAnalysisData;
  fid = 0;

  constructor(private as: AnalysisService) {
    this.as = as;
   }

  ngOnInit() {
    this.functionTypes = this.as.getFunctionTypes();
    this.data = this.as.getData();
    this.plotData[0].x = this.data.series.map(d => d.x);
    this.plotData[0].y = this.data.series.map(d => d.y);
  }

  ngAfterContentInit() {
    this.systemForm.form.valueChanges.pipe(debounceTime(200)).subscribe({
      next: this.handleChange.bind(this),
      error: this.handleError.bind(this)
    });
    this.exciteForm.form.valueChanges.pipe(debounceTime(200)).subscribe((change: Object)=>{
      if (change["fid"]) {
        this.data.func = this.functionTypes[change["fid"]];
      }
      if (change["fid"] < 5) {
        this.data.series = this.as.createTimeSeries(this.data);
        this.plotData[0].x = this.data.series.map(d => d.x);
        this.plotData[0].y = this.data.series.map(d => d.y);
      } else {
        //need to wait for file upload
        this.plotData[0].x = [];
        this.plotData[0].y = [];
      }
    });
  };

  handleError(err) {
    console.error(err);
  }
  handleChange(change) {
    // console.log(change);
  }

  functionChange(id: number) {
    console.log('function changed to:', id)
    this.data.func = this.functionTypes[id];
  }

  debug() {
    console.log(this.data);
  }

}
