import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout-component/auth-layout-component';
import { WorkspaceLayoutComponent } from './layouts/workspace-layout-component/workspace-layout-component';

export const routes: Routes = [
  { path: '', component: AuthLayoutComponent },
  { path: 'workspace', component: WorkspaceLayoutComponent },
];
