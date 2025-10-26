import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout-component/auth-layout-component';
import { WorkspaceLayoutComponent } from './layouts/workspace-layout-component/workspace-layout-component';
import { ImprintLayoutComponent } from './layouts/imprint-layout-component/imprint-layout.component';
import { PrivacyPolicyLayoutComponent } from './layouts/privacy-policy-layout-component/privacy-policy-layout.component';
import { DmInterfaceContent } from './features/workspace/components/dm-interface-content/dm-interface-content';
import { ChannelInterfaceContent } from './features/workspace/components/channel-interface-content/channel-interface-content';
import { PasswordResetComponent } from './features/authentication/components/password-reset/password-reset.component';
import { ConfirmNewPasswordComponent } from './features/authentication/components/password-reset/confirm-new-password/confirm-new-password.component';

export const AuthRoutes: Routes = [
  { path: '', component: AuthLayoutComponent, loadChildren: () => import('./features/authentication/modules/auth-routing-module').then(m => m.AuthRoutingModuleModule) },
  { path: 'password-reset', component: PasswordResetComponent },
  { path: 'confirm-new-password', component: ConfirmNewPasswordComponent },
  { path: 'workspace', component: WorkspaceLayoutComponent },
  { path: 'privacy-policy', component: PrivacyPolicyLayoutComponent },
  {
    path: 'imprint',
    component: ImprintLayoutComponent,
  },
];
