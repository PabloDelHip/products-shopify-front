<script>
import axios from "axios";
import { avatar1 } from "@/assets/images/users/data";
import { useAuthStore, useLayoutStore } from "@/state/pinia";
import syscomService from "@/services/syscom";
import Swal from "sweetalert2";
const auth = useAuthStore();

/**
 * Nav-bar Component
 */
export default {
  data() {
    return {
      avatar1,
      loadingSyscom: false,
    };
  },
  components: {},
  mounted() {
    document.body.setAttribute("data-bs-theme", this.layout.mode);
  },
  computed: {
    currentUser() {
      return auth.currentUser;
    },
    layout() {
      return useLayoutStore();
    },
  },
  methods: {
    toggleMenu() {
      this.$parent.toggleMenu();
    },
    logoutUser() {
      // eslint-disable-next-line no-unused-vars
      axios.get("http://127.0.0.1:8000/api/logout").then((res) => {
        this.$router.push({
          name: "default",
        });
      });
    },

    async testSyscom() {
      this.loadingSyscom = true;
      try {
        await syscomService.authenticate();
        Swal.fire({
          title: "¡Conexión Exitosa!",
          text: "El sistema se ha conectado correctamente con la API de Syscom.",
          icon: "success",
          confirmButtonColor: "#34c38f",
        });
      } catch (error) {
        Swal.fire({
          title: "Error de Conexión",
          text: "No se pudo establecer conexión con Syscom. Por favor, verifica tus credenciales.",
          icon: "error",
          confirmButtonColor: "#f46a6a",
        });
      } finally {
        this.loadingSyscom = false;
      }
    },
  },
};
</script>

<template>
  <header id="page-topbar">
    <div class="navbar-header">
      <div class="d-flex">
        <!-- LOGO -->
        <div class="navbar-brand-box">
          <router-link to="/" class="logo logo-dark">
            <span class="logo-sm">
              <img src="@/assets/images/logo.svg" alt height="22" />
            </span>
            <span class="logo-lg">
              <img src="@/assets/images/logo-dark.png" alt height="17" />
            </span>
          </router-link>

          <router-link to="/" class="logo logo-light">
            <span class="logo-sm">
              <img src="@/assets/images/logo-light.svg" alt height="40" />
            </span>
            <span class="logo-lg">
              <img src="@/assets/images/logo-light.svg" alt height="58" />
            </span>
          </router-link>
        </div>

        <BButton
          variant="white"
          id="vertical-menu-btn"
          type="button"
          class="btn btn-sm px-3 font-size-16 header-item"
          @click="toggleMenu"
        >
          <i class="fa fa-fw fa-bars"></i>
        </BButton>
      </div>

      <div class="d-flex">
        <button
          class="header-item px-3 d-flex align-items-center border-0 bg-transparent text-info"
          @click="testSyscom"
          :disabled="loadingSyscom"
        >
          <i
            class="bx bx-key font-size-18 align-middle me-2"
            :class="{ 'bx-spin': loadingSyscom }"
          ></i>
          <span class="d-none d-md-inline-block fw-medium">
            {{ loadingSyscom ? "Probando..." : "Probar Conexión" }}
          </span>
        </button>

        <a
          href="/logout"
          class="header-item text-danger px-3 d-flex align-items-center"
        >
          <i class="bx bx-power-off font-size-18 align-middle me-2"></i>
          <span class="d-none d-md-inline-block fw-medium">Cerrar sesión</span>
        </a>
      </div>
    </div>
  </header>
</template>
