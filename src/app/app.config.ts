import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { MAT_RIPPLE_GLOBAL_OPTIONS, RippleGlobalOptions } from '@angular/material/core';

import { AuthRoutes } from './app.routes';
import { initializeApp, provideFirebaseApp, getApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { environment } from '../environments/environment.development';
import { AppRoutingModule } from './app-routing-module';

const globalRippleConfig: RippleGlobalOptions = {
  disabled: true
};

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(AppRoutingModule),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(AuthRoutes),
    provideFirebaseApp(() =>
      initializeApp(environment.firebase)
    ),
    provideAuth(() => getAuth()),
    provideFirestore(() => {
      // Offline Persistence mit 1MB Cache (TIER 2, Fix 7)
      const firestore = initializeFirestore(getApp(), {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: 1 * 1024 * 1024, // 1 MB Cache-Limit
        }),
      });
      return firestore;
    }),
    {provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig}

  ],
};
