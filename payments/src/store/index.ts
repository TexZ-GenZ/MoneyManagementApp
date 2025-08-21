import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import companiesSlice from './companiesSlice';
import billsSlice from './billsSlice';


export const store = configureStore({
  reducer: {
    auth: authSlice,
    companies: companiesSlice,
    bills: billsSlice,

  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
