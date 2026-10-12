const SESSION_KEY = "focoya-demo-session";

export function isDemoAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === "authenticated";
}

export function startDemoSession() {
  sessionStorage.setItem(SESSION_KEY, "authenticated");
}

export function endDemoSession() {
  sessionStorage.removeItem(SESSION_KEY);
}