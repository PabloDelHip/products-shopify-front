<script>
import axios from "axios";

import Layout from "../../layouts/auth";

import { required, email, helpers } from "@vuelidate/validators";
import useVuelidate from "@vuelidate/core";

import {
  useAuthFakeStore,
  useAuthStore,
  useNotificationStore,
} from "@/state/pinia";
const authFake = useAuthFakeStore();
const auth = useAuthStore();
const notificationStore = useNotificationStore();

/**
 * Login component
 */
export default {
  setup() {
    return { v$: useVuelidate() };
  },

  components: {
    Layout,
  },
  data() {
    return {
      email: "admin@conectos.com",
      password: "password123",
      submitted: false,
      authError: null,
      tryingToLogIn: false,
      isAuthError: false,
    };
  },
  validations: {
    email: {
      required: helpers.withMessage("Email is required", required),
      email: helpers.withMessage("Please enter valid email", email),
    },
    password: {
      required: helpers.withMessage("Password is required", required),
    },
  },
  computed: {
    notification() {
      return notificationStore || {};
    },
  },
  methods: {
    // Try to log the user in with the username
    // and password they provided.
    tryToLogIn() {
      this.submitted = true;
      // stop here if form is invalid
      this.v$.$touch();

      if (this.v$.$invalid) {
        return;
      } else {
        notificationStore.clear();
        if (process.env.VUE_APP_DEFAULT_AUTH === "firebase") {
          this.tryingToLogIn = true;
          // Reset the authError if it existed.
          this.authError = null;
          auth
            .logIn({
              email: this.email,
              password: this.password,
            })
            .then((response) => {
              this.tryingToLogIn = false;
              this.isAuthError = false;
              auth.setUser(response);
              window.location.href = "/";
            })
            .catch((error) => {
              this.tryingToLogIn = false;
              this.authError = error ? error : "";
              this.isAuthError = true;
              notificationStore.setMessage(
                error.message || "An unknown error occurred.",
                "danger"
              );
            });
        } else if (process.env.VUE_APP_DEFAULT_AUTH === "fakebackend") {
          const { email, password } = this;
          if (email && password) {
            this.tryingToLogIn = true;
            authFake
              .login(email, password)
              .catch(() => {
                // Error is already handled in the store actions (notificationStore)
              })
              .finally(() => {
                this.tryingToLogIn = false;
              });
          }
        } else if (process.env.VUE_APP_DEFAULT_AUTH === "authapi") {
          axios
            .post("http://127.0.0.1:8000/api/login", {
              email: this.email,
              password: this.password,
            })
            .then((res) => {
              return res;
            });
        }
      }
    },
  },
  watch: {
    // Watch for changes in authFake status to reset loading if there is an error
    "authFake.status": {
      handler(status) {
        if (!status.loggingIn) {
          this.tryingToLogIn = false;
        }
      },
      deep: true,
    },
  },
};
</script>

<template>
  <Layout>
    <BRow class="justify-content-center">
      <BCol md="8" lg="6" xl="5">
        <BCard no-body class="overflow-hidden">
          <div class="bg-primary-subtle">
            <BRow>
              <BCol cols="7">
                <div class="text-primary p-4">
                  <h5 class="text-primary">¡Bienvenido de nuevo!</h5>
                  <p>Inicia sesión.</p>
                </div>
              </BCol>
              <BCol cols="5" class="align-self-end">
                <img
                  src="@/assets/images/profile-img.png"
                  alt
                  class="img-fluid"
                />
              </BCol>
            </BRow>
          </div>
          <BCardBody class="pt-0">
            <div>
              <router-link to="/">
                <div class="avatar-md profile-user-wid mb-4">
                  <span class="avatar-title rounded-circle bg-light">
                    <img src="@/assets/images/logo.svg" alt height="34" />
                  </span>
                </div>
              </router-link>
            </div>
            <div
              v-if="notification.message"
              :class="'alert ' + notification.type + ' mt-3'"
            >
              {{ notification.message }}
            </div>

            <BForm class="p-2" @submit.prevent="tryToLogIn">
              <BFormGroup
                class="mb-3"
                id="input-group-1"
                label="Email"
                label-for="input-1"
              >
                <BFormInput
                  id="input-1"
                  v-model="email"
                  type="text"
                  placeholder="Enter email"
                  :class="{
                    'is-invalid': submitted && v$.email.$error,
                  }"
                ></BFormInput>
                <div
                  v-for="(item, index) in v$.email.$errors"
                  :key="index"
                  class="invalid-feedback"
                >
                  <span v-if="item.$message">{{ item.$message }}</span>
                </div>
              </BFormGroup>

              <BFormGroup
                class="mb-3"
                id="input-group-2"
                label="Password"
                label-for="input-2"
              >
                <BFormInput
                  id="input-2"
                  v-model="password"
                  type="password"
                  placeholder="Enter password"
                  :class="{
                    'is-invalid': submitted && v$.password.$error,
                  }"
                ></BFormInput>
                <div
                  v-if="submitted && v$.password.$error"
                  class="invalid-feedback"
                >
                  <span v-if="v$.password.required.$message">{{
                    v$.password.required.$message
                  }}</span>
                </div>
              </BFormGroup>
              <div class="mt-3 d-grid">
                <BButton
                  type="submit"
                  variant="primary"
                  class="btn-block"
                  :disabled="tryingToLogIn"
                >
                  <span
                    v-if="tryingToLogIn"
                    class="spinner-border spinner-border-sm me-1"
                    role="status"
                  ></span>
                  {{ tryingToLogIn ? "Iniciando sesión..." : "Log In" }}
                </BButton>
              </div>
            </BForm>
          </BCardBody>
        </BCard>
      </BCol>
    </BRow>
  </Layout>
</template>
