import { defineStore } from "pinia";
import localApiService from "@/services/localApi";

export const useUserStore = defineStore("users", {
  state: () => ({
    users: [],
    pagination: {
      currentPage: 1,
      lastPage: 1,
      total: 0,
    },
    loading: false,
    error: null,
  }),
  actions: {
    async fetchUsers(page = 1) {
      this.loading = true;
      this.error = null;
      try {
        const res = await localApiService.getUsers(page);
        if (res.ok) {
          this.users = res.data.data;
          this.pagination = {
            currentPage: res.data.current_page,
            lastPage: res.data.last_page,
            total: res.data.total,
          };
        }
      } catch (e) {
        this.error = e?.response?.data?.message || "Error al cargar usuarios";
      } finally {
        this.loading = false;
      }
    },

    async createUser(data) {
      const res = await localApiService.createUser(data);
      if (res.ok) await this.fetchUsers(this.pagination.currentPage);
      return res;
    },

    async updateUser(id, data) {
      const res = await localApiService.updateUser(id, data);
      if (res.ok) await this.fetchUsers(this.pagination.currentPage);
      return res;
    },

    async deleteUser(id) {
      const res = await localApiService.deleteUser(id);
      if (res.ok) await this.fetchUsers(this.pagination.currentPage);
      return res;
    },
  },
});
