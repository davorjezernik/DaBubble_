import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout-component/auth-layout-component';
import { WorkspaceLayoutComponent } from './layouts/workspace-layout-component/workspace-layout-component';
import { ImprintLayoutComponent } from './layouts/imprint-layout-component/imprint-layout.component';
import { PrivacyPolicyLayoutComponent } from './layouts/privacy-policy-layout-component/privacy-policy-layout.component';
import { DmInterfaceContent } from './features/workspace/components/dm-interface-content/dm-interface-content';
import { ChannelInterfaceContent } from './features/workspace/components/channel-interface-content/channel-interface-content';

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
    children: [
      { path: 'dm/:id', component: DmInterfaceContent },
      { path: 'channel/:id', component: ChannelInterfaceContent },

    ],
  },
  { path: 'privacy-policy', component: PrivacyPolicyLayoutComponent },
  {
    path: 'imprint',
    component: ImprintLayoutComponent,
  },
];
