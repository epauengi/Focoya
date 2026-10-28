import { RouterProvider } from "react-router";
import { router } from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { useEffect } from "react";
import { getSession, subscribeSession } from "./auth/session";

export function App() {
  useEffect(() => {
    let userId = getSession().user?.id;
    return subscribeSession(() => {
      const nextUserId = getSession().user?.id;
      if (nextUserId !== userId) queryClient.clear();
      userId = nextUserId;
    });
  }, []);
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>;
}

export default App;
