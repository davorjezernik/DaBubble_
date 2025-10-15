import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { PasswordResetComponent } from '../components/password-reset/password-reset.component';
import { AvatarSelectComponent } from '../components/avatar-selection/avatar-selection-component';
import { SignupComponent } from '../components/signup/signup-component';
import { LoginComponent } from '../components/login/login-component';

const routes: Routes = [
  {
    path: '',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'signup', component: SignupComponent },
      { path: 'select-avatar', component: AvatarSelectComponent },
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
