import axios from "axios";

const LOCAL_API_URL =
  process.env.VUE_APP_LOCAL_API_URL || "http://localhost:8000/api/v1";

class LocalApiService {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem("local_api_token", token);
  }

  getApiClient() {
    // Priority 1: Token from the authenticated user session
    const user = JSON.parse(localStorage.getItem("user"));
    let token = user ? user.token : null;

    // Priority 2: Explicitly set token (e.g. via setToken)
    if (!token) {
      token = this.token || localStorage.getItem("local_api_token");
    }

    // Priority 3: Environment variable (only as a last resort fallback)
    if (!token) {
      token = process.env.VUE_APP_LOCAL_API_TOKEN;
    }

    const instance = axios.create({
      baseURL: LOCAL_API_URL,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        Accept: "application/json",
      },
    });

    // Handle 401 Unauthorized (Expired Token)
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          if (window.location.pathname !== "/login") {
            localStorage.removeItem("user");
            window.location.reload();
          }
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  async getCategories() {
    try {
      const client = this.getApiClient();
      const response = await client.get("/category", {
        params: { provider: "syscom" },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching local categories:", error);
      return [];
    }
  }

  async getCategoryTree() {
    try {
      const client = this.getApiClient();
      const response = await client.get("/category/tree", {
        params: { provider: "syscom" },
      });
      // Response: { ok: true, data: [...] }
      return response.data.data || response.data;
    } catch (error) {
      console.error("Error fetching category tree:", error);
      return [];
    }
  }

  async getCategoryAncestors(providerCategoryId) {
    try {
      const client = this.getApiClient();
      const response = await client.get("/category/ancestors", {
        params: {
          provider: "syscom",
          provider_category_id: providerCategoryId,
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error("Error fetching category ancestors:", error);
      return [];
    }
  }

  async toggleCategoryStatus(id, active) {
    try {
      const client = this.getApiClient();
      const response = await client.put(`/category/${id}/active`, { active });
      return response.data;
    } catch (error) {
      console.error("Error toggling category status:", error);
      throw error;
    }
  }

  async createCategories(categories) {
    try {
      const client = this.getApiClient();
      const response = await client.post("/category", categories);
      return response.data;
    } catch (error) {
      console.error("Error creating categories:", error);
      throw error;
    }
  }

  async syncProducts(products) {
    try {
      const client = this.getApiClient();
      // The user specified /shopify/products and a { products: [...] } wrapper
      const response = await client.post("/shopify/products", { products });
      return response.data;
    } catch (error) {
      console.error("Error syncing products to Shopify:", error);
      throw error;
    }
  }

  async processProductUploads(limit = 1) {
    try {
      const client = this.getApiClient();
      const response = await client.post("/shopify/products/uploads/process", {
        limit,
      });
      return response.data;
    } catch (error) {
      console.error("Error processing product uploads:", error);
      throw error;
    }
  }

  async getUploadMetrics() {
    try {
      const client = this.getApiClient();
      const response = await client.get("/shopify/product-uploads/metrics");
      return response.data;
    } catch (error) {
      console.error("Error fetching upload metrics:", error);
      throw error;
    }
  }

  async getSyncedProductsByProvider(
    provider,
    categoryId,
    page = 1,
    perPage = 20
  ) {
    try {
      const client = this.getApiClient();
      const response = await client.get(
        `/shopify/products/provider/${provider}`,
        {
          params: { category_id: categoryId, page, per_page: perPage },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching synced products for ${provider}:`, error);
      return { ok: false, data: { data: [] } };
    }
  }

  async getShopifyUploadsReport(params = {}) {
    try {
      const client = this.getApiClient();
      const response = await client.get("/shopify/reports/uploads", {
        params,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching Shopify uploads report:", error);
      throw error;
    }
  }

  async exportShopifyUploads(params = {}) {
    try {
      const client = this.getApiClient();
      const response = await client.get("/shopify/reports/uploads", {
        params: { ...params, export: "true" },
        responseType: "blob",
      });
      return response;
    } catch (error) {
      console.error("Error exporting Shopify uploads report:", error);
      throw error;
    }
  }
}

export default new LocalApiService();
