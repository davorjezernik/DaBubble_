import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout-component/auth-layout-component';
import { WorkspaceLayoutComponent } from './layouts/workspace-layout-component/workspace-layout-component';
import { ImprintLayoutComponent } from './layouts/imprint-layout-component/imprint-layout.component';
import { PrivacyPolicyLayoutComponent } from './layouts/privacy-policy-layout-component/privacy-policy-layout.component';
import { ChatInterfaceComponent } from './features/workspace/components/chat-interface-content/chat-interface-content';

export const AuthRoutes: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    loadChildren: () =>
      import('./features/authentication/modules/auth-routing-module').then(
        (m) => m.AuthRoutingModuleModule
      ),
  },
  {
    path: 'workspace',
    component: WorkspaceLayoutComponent,
    children: [{ path: 'dm/:id', component: ChatInterfaceComponent }],
  },
  { path: 'privacy-policy', component: PrivacyPolicyLayoutComponent },
  {
    path: 'imprint',
    component: ImprintLayoutComponent,
  },
];
