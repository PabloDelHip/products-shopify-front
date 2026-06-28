<script>
import { Modal } from "bootstrap";
import { useUserStore } from "@/state/pinia/users";

export default {
  name: "UserFormModal",
  emits: ["saved"],
  data() {
    return {
      modal: null,
      saving: false,
      editingUser: null,
      form: { name: "", email: "", password: "" },
      errors: {},
    };
  },
  computed: {
    isEditing() {
      return !!this.editingUser;
    },
  },
  mounted() {
    this.modal = new Modal(this.$refs.modalEl);
  },
  beforeUnmount() {
    this.modal?.dispose();
  },
  methods: {
    show(user = null) {
      this.editingUser = user;
      this.errors = {};
      this.form = user
        ? { name: user.name, email: user.email, password: "" }
        : { name: "", email: "", password: "" };
      this.modal.show();
    },
    hide() {
      this.modal.hide();
    },
    async submit() {
      this.errors = {};
      this.saving = true;
      const store = useUserStore();
      try {
        const payload = { name: this.form.name, email: this.form.email };
        if (this.form.password) payload.password = this.form.password;

        if (this.isEditing) {
          await store.updateUser(this.editingUser.id, payload);
        } else {
          await store.createUser({ ...payload, password: this.form.password });
        }
        this.hide();
        this.$emit("saved");
      } catch (error) {
        const status = error?.response?.status;
        const data = error?.response?.data;
        if (status === 422 && data?.errors) {
          this.errors = data.errors;
        } else {
          this.errors = {
            _general: data?.message || "Ocurrió un error inesperado.",
          };
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <div class="modal fade" ref="modalEl" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            {{ isEditing ? "Editar usuario" : "Nuevo usuario" }}
          </h5>
          <button
            type="button"
            class="btn-close"
            @click="hide"
            aria-label="Cerrar"
          ></button>
        </div>
        <div class="modal-body">
          <div
            v-if="errors._general"
            class="alert alert-danger font-size-13 py-2"
          >
            {{ errors._general }}
          </div>
          <form @submit.prevent="submit">
            <div class="mb-3">
              <label class="form-label">Nombre</label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.name }"
                v-model="form.name"
                placeholder="Nombre completo"
              />
              <div v-if="errors.name" class="invalid-feedback">
                {{ Array.isArray(errors.name) ? errors.name[0] : errors.name }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input
                type="email"
                class="form-control"
                :class="{ 'is-invalid': errors.email }"
                v-model="form.email"
                placeholder="correo@ejemplo.com"
              />
              <div v-if="errors.email" class="invalid-feedback">
                {{
                  Array.isArray(errors.email) ? errors.email[0] : errors.email
                }}
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label">
                Contraseña
                <span v-if="isEditing" class="text-muted font-size-12"
                  >(dejar en blanco para no cambiar)</span
                >
              </label>
              <input
                type="password"
                class="form-control"
                :class="{ 'is-invalid': errors.password }"
                v-model="form.password"
                placeholder="••••••••"
                :required="!isEditing"
              />
              <div v-if="errors.password" class="invalid-feedback">
                {{
                  Array.isArray(errors.password)
                    ? errors.password[0]
                    : errors.password
                }}
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="hide">
            Cancelar
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="submit"
            :disabled="saving"
          >
            <span
              v-if="saving"
              class="spinner-border spinner-border-sm me-1"
            ></span>
            {{ saving ? "Guardando..." : "Guardar" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
