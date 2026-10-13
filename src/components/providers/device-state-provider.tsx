"use client";

import * as React from "react";
import { mockDevices, mockDeviceStates } from "@/data/mock-smart-estate";
import { DeviceStore } from "@/lib/device-store";

const DeviceStoreContext = React.createContext<DeviceStore | null>(null);

export function DeviceStateProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(
    () => new DeviceStore(mockDevices, mockDeviceStates),
  );

  return (
    <DeviceStoreContext.Provider value={store}>
      {children}
    </DeviceStoreContext.Provider>
  );
}

export function useDeviceStore() {
  const store = React.useContext(DeviceStoreContext);
  if (!store) throw new Error("useDeviceStore must be used inside DeviceStateProvider");
  return store;
}

export function useDevices() {
  const store = useDeviceStore();
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
