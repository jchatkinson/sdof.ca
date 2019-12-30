import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ToolComponent } from './tool/tool.component';
import { AboutComponent } from './about/about.component';


const routes: Routes = [
  {path: "about", component: AboutComponent},
  {path: "", component: ToolComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
