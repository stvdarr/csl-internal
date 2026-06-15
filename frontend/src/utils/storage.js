const TOKEN_KEY = "token";
const ROLE_KEY = "role";
const USER_KEY = "user";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const getRole = () => sessionStorage.getItem(ROLE_KEY);
export const getUser = () => {
  const userStr = sessionStorage.getItem(USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setAuthData = (token, role, user) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ROLE_KEY, role);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthData = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export const getStoredSession = () => {
  const token = getToken();
  const role = getRole();
  const profile = getUser();

  if (!token || !role || !profile) return null;

  return { token, role, profile };
};
