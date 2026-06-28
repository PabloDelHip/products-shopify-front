import axios from "axios";

const LOCAL_API_URL =
  process.env.VUE_APP_LOCAL_API_URL || "http://localhost:8000/api/v1";
const SYSCOM_AUTH_URL = `${LOCAL_API_URL}/syscom/auth/login`;
const SYSCOM_API_URL = `${LOCAL_API_URL}/syscom/`;

class SyscomService {
  constructor() {
    this.clientId = process.env.VUE_APP_SYSCOM_CLIENT_ID;
    this.clientSecret = process.env.VUE_APP_SYSCOM_CLIENT_SECRET;
    this.token = localStorage.getItem("syscom_token");
  }

  async authenticate() {
    try {
      console.log("Authenticating with Syscom via Backend...");
      console.log("LOCAL_API_URL", LOCAL_API_URL);
      console.log("SYSCOM_AUTH_URL", SYSCOM_AUTH_URL);
      console.log("SYSCOM_API_URL", SYSCOM_API_URL);
      console.log("clientId", this.clientId);
      console.log("clientSecret", this.clientSecret);
      console.log("token", this.token);
      // Obtenemos el token de tu usuario para autorizar la petición al backend
      const user = JSON.parse(localStorage.getItem("user"));
      const localToken = user ? user.token : null;
      console.log("user", user);
      console.log("localToken", localToken);

      const params = new URLSearchParams();
      params.append("client_id", this.clientId);
      params.append("client_secret", this.clientSecret);
      params.append("grant_type", "client_credentials");

      const response = await axios.post(SYSCOM_AUTH_URL, params, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: localToken ? `Bearer ${localToken}` : "",
        },
      });

      const { access_token } = response.data;
      this.token = access_token;
      localStorage.setItem("syscom_token", access_token);

      return access_token;
    } catch (error) {
      console.error("Error authenticating with Syscom via Backend:", error);
      throw error;
    }
  }

  getApiClient() {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = user ? user.token : this.token;

    const instance = axios.create({
      baseURL: SYSCOM_API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    // Interceptor to handle token expiration (401)
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.authenticate();
          originalRequest.headers["Authorization"] = `Bearer ${this.token}`;
          return instance(originalRequest);
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  async getCategories() {
    if (!this.token) await this.authenticate();
    const client = this.getApiClient();
    const response = await client.get("categorias");
    return response.data;
  }

  async getCategoryDetail(id) {
    if (!this.token) await this.authenticate();
    const client = this.getApiClient();
    const response = await client.get(`categorias/${id}`);
    return response.data;
  }

  async getProducts({ categoria, pagina = 1, porPagina = 20 } = {}) {
    if (!this.token) await this.authenticate();
    const client = this.getApiClient();
    const params = { pagina, por_pagina: porPagina };
    if (categoria) params.categoria = categoria;
    const response = await client.get("productos", { params });
    return response.data; // { productos: [...], total: N, paginas: N }
  }

  async getProductDetail(id) {
    if (!this.token) await this.authenticate();
    const client = this.getApiClient();
    const response = await client.get(`productos/${id}`);
    return response.data;
  }
}

export default new SyscomService();
