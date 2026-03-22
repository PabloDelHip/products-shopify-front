import { authHeader } from "./auth-header";

export const userService = {
  login,
  logout,
  register,
  getAll,
};

const LOCAL_API_URL =
  process.env.VUE_APP_LOCAL_API_URL || "http://localhost:8000/api/v1";

function login(email, password) {
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  };

  return fetch(`${LOCAL_API_URL}/auth/login`, requestOptions)
    .then(handleResponse)
    .then((response) => {
      // response structured as { ok: true, data: { access_token, user } }
      if (response.ok && response.data.access_token) {
        const user = {
          ...response.data.user,
          token: response.data.access_token,
        };
        // store user details and jwt token in local storage
        localStorage.setItem("user", JSON.stringify(user));
        return user;
      }
      return Promise.reject("Estructura de respuesta inválida");
    });
}

function logout() {
  // remove user from local storage to log user out
  localStorage.removeItem("user");
  localStorage.removeItem("syscom_token");
}

function register(user) {
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  };
  return fetch(`/users/register`, requestOptions).then(handleResponse);
}

function getAll() {
  const requestOptions = {
    method: "GET",
    headers: authHeader(),
  };
  return fetch(`/users`, requestOptions).then(handleResponse);
}

function handleResponse(response) {
  return response.text().then((text) => {
    const data = text && JSON.parse(text);
    if (!response.ok) {
      const error = (data && data.message) || response.statusText;
      return Promise.reject(error);
    }
    return data;
  });
}
