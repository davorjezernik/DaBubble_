import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { DialogLoginComponent } from '../components/dialog.login-component/dialog.login-component';
import { DialogSignupComponent } from '../components/dialog.signup-component/dialog.signup-component';
import { DialogAvatarSelectComponent } from '../components/dialog.avatar-select-component/dialog.avatar-select-component';
import { PasswordResetComponent } from '../components/password-reset/password-reset.component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'login', component: DialogLoginComponent },
      { path: 'signup', component: DialogSignupComponent },
      { path: 'select-avatar', component: DialogAvatarSelectComponent },
      { path: 'password-reset', component: PasswordResetComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' }, // default route
    ],
  },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class AuthRoutingModuleModule {}
