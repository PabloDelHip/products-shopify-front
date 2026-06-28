<script>
import Layout from "../../layouts/main";
import PageHeader from "@/components/page-header";
import UserFormModal from "@/components/users/UserFormModal.vue";
import { useUserStore } from "@/state/pinia/users";
import Swal from "sweetalert2";

export default {
  components: { Layout, PageHeader, UserFormModal },
  setup() {
    return { store: useUserStore() };
  },
  computed: {
    users() {
      return this.store.users;
    },
    pagination() {
      return this.store.pagination;
    },
    loading() {
      return this.store.loading;
    },
    error() {
      return this.store.error;
    },
    paginationItems() {
      const total = this.pagination.lastPage;
      const current = this.pagination.currentPage;
      const delta = 2;
      const range = [];
      const result = [];
      let last;

      for (let i = 1; i <= total; i++) {
        if (
          i === 1 ||
          i === total ||
          (i >= current - delta && i <= current + delta)
        ) {
          range.push(i);
        }
      }
      for (const page of range) {
        if (last) {
          if (page - last === 2) result.push(last + 1);
          else if (page - last > 2) result.push("...");
        }
        result.push(page);
        last = page;
      }
      return result;
    },
  },
  async mounted() {
    await this.store.fetchUsers(1);
  },
  methods: {
    async goToPage(page) {
      if (page < 1 || page > this.pagination.lastPage) return;
      await this.store.fetchUsers(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    openCreate() {
      this.$refs.userModal.show();
    },
    openEdit(user) {
      this.$refs.userModal.show(user);
    },
    async confirmDelete(user) {
      const result = await Swal.fire({
        title: "¿Eliminar usuario?",
        html: `¿Estás seguro de eliminar a <strong>${user.name}</strong>? Esta acción no se puede deshacer.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#f46a6a",
        cancelButtonColor: "#74788d",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) return;

      try {
        await this.store.deleteUser(user.id);
        Swal.fire({
          icon: "success",
          title: "Eliminado",
          text: "Usuario eliminado correctamente.",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (error) {
        Swal.fire(
          "Error",
          error?.response?.data?.message || "No se pudo eliminar el usuario.",
          "error"
        );
      }
    },
    formatDate(dateString) {
      if (!dateString) return "-";
      return new Date(dateString).toLocaleString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
};
</script>

<template>
  <Layout>
    <PageHeader title="Usuarios" pageTitle="Módulo" />
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-body">
            <div class="row mb-4 align-items-center">
              <div class="col-sm-6">
                <h4 class="card-title mb-1">Usuarios del sistema</h4>
                <p class="text-muted mb-0 font-size-13">
                  {{ pagination.total }} usuarios registrados
                </p>
              </div>
              <div class="col-sm-6 text-sm-end mt-3 mt-sm-0">
                <button class="btn btn-primary" @click="openCreate">
                  <i class="bx bx-plus me-1"></i> Nuevo usuario
                </button>
              </div>
            </div>

            <div v-if="error" class="alert alert-danger">{{ error }}</div>

            <div v-if="loading" class="text-center py-5">
              <div class="spinner-border text-primary" role="status"></div>
              <p class="text-muted mt-2">Cargando usuarios...</p>
            </div>

            <div v-else class="table-responsive">
              <table class="table align-middle table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width: 60px">ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Fecha de creación</th>
                    <th style="width: 120px">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in users" :key="user.id">
                    <td class="text-muted font-size-13">{{ user.id }}</td>
                    <td>
                      <div class="d-flex align-items-center">
                        <div
                          class="avatar-title rounded-circle bg-soft-primary text-primary font-size-14 me-3"
                          style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0"
                        >
                          {{ user.name ? user.name.charAt(0).toUpperCase() : "?" }}
                        </div>
                        <span class="fw-medium">{{ user.name }}</span>
                      </div>
                    </td>
                    <td class="text-muted">{{ user.email }}</td>
                    <td>
                      <span class="text-muted font-size-12">{{
                        formatDate(user.created_at)
                      }}</span>
                    </td>
                    <td>
                      <div class="d-flex gap-2">
                        <button
                          class="btn btn-soft-info btn-sm"
                          @click="openEdit(user)"
                          title="Editar"
                        >
                          <i class="bx bx-edit"></i>
                        </button>
                        <button
                          class="btn btn-soft-danger btn-sm"
                          @click="confirmDelete(user)"
                          title="Eliminar"
                        >
                          <i class="bx bx-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="users.length === 0 && !loading">
                    <td colspan="5" class="text-center py-5">
                      <i class="bx bx-user font-size-36 text-muted mb-2"></i>
                      <p class="text-muted mb-0">No hay usuarios registrados.</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              class="d-flex align-items-center justify-content-between mt-4"
              v-if="pagination.lastPage > 1"
            >
              <span class="text-muted font-size-13">
                Página <strong>{{ pagination.currentPage }}</strong> de
                <strong>{{ pagination.lastPage }}</strong> &nbsp;·&nbsp;
                {{ pagination.total }} usuarios
              </span>
              <ul class="pagination pagination-rounded mb-0 flex-wrap">
                <li
                  class="page-item"
                  :class="{ disabled: pagination.currentPage === 1 }"
                >
                  <a
                    href="javascript:void(0);"
                    class="page-link"
                    @click="goToPage(pagination.currentPage - 1)"
                  >
                    <i class="bx bx-chevron-left"></i>
                  </a>
                </li>
                <li
                  v-for="(item, idx) in paginationItems"
                  :key="idx"
                  :class="[
                    'page-item',
                    item === '...' ? 'disabled' : '',
                    pagination.currentPage === item ? 'active' : '',
                  ]"
                >
                  <span v-if="item === '...'" class="page-link">…</span>
                  <a
                    v-else
                    href="javascript:void(0);"
                    class="page-link"
                    @click="goToPage(item)"
                    >{{ item }}</a
                  >
                </li>
                <li
                  class="page-item"
                  :class="{
                    disabled: pagination.currentPage === pagination.lastPage,
                  }"
                >
                  <a
                    href="javascript:void(0);"
                    class="page-link"
                    @click="goToPage(pagination.currentPage + 1)"
                  >
                    <i class="bx bx-chevron-right"></i>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UserFormModal ref="userModal" @saved="store.fetchUsers(pagination.currentPage)" />
  </Layout>
</template>
