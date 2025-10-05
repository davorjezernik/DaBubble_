import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout-component/auth-layout-component';
import { WorkspaceLayoutComponent } from './layouts/workspace-layout-component/workspace-layout-component';
import { ImpressumComponent } from './shared/impressum/impressum.component';
import { PrivacyPolicyComponent } from './shared/privacy-policy/privacy-policy.component';

export const routes: Routes = [
  { path: '', component: AuthLayoutComponent },
  { path: 'workspace', component: WorkspaceLayoutComponent },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'imprint', component: ImpressumComponent },
];
