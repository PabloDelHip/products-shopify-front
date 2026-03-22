<script>
import axios from "axios";

import Layout from "../../layouts/auth";

import { required, email, helpers } from "@vuelidate/validators";
import useVuelidate from "@vuelidate/core";

import { useAuthStore, useAuthFakeStore, useNotificationStore } from '@/state/pinia'
const auth = useAuthStore()
const fakeAuth = useAuthFakeStore()
const notificationStore = useNotificationStore();

/**
 * Register component
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
      user: {
        username: "",
        email: "",
        password: "",
      },
      submitted: false,
      regError: null,
      tryingToRegister: false,
      isRegisterError: false,
      registerSuccess: false,
    };
  },
  validations: {
    user: {
      username: {
        required: helpers.withMessage("Username is required", required),
      },
      email: {
        required: helpers.withMessage("Email is required", required),
        email: helpers.withMessage("Please enter valid email", email),
      },
      password: {
        required: helpers.withMessage("Password is required", required),
      },
    },
  },
  computed: {
    notification() {
      return notificationStore || {};
    },
  },
  methods: {
    // Try to register the user in with the email, username
    // and password they provided.
    tryToRegisterIn() {
      this.submitted = true;
      // stop here if form is invalid
      this.v$.$touch();

      if (this.v$.$invalid) {
        return;
      } else {
        if (process.env.VUE_APP_DEFAULT_AUTH === "firebase") {
          this.tryingToRegister = true;
          // Reset the regError if it existed.
          this.regError = null;
          auth.register({
            username: this.user.username,
            email: this.user.email,
            password: this.user.password,
          }).then(() => {
            this.tryingToRegister = false;
            this.isRegisterError = false;
            this.registerSuccess = true;
            window.location.href = "/"
          }).catch((error) => {
            this.tryingToRegister = false;
            this.regError = error ? error : "";
            this.isRegisterError = true;
          })
        } else if (process.env.VUE_APP_DEFAULT_AUTH === "fakebackend") {
          const { email, username, password } = this.user;
          if (email && username && password) {
            fakeAuth.registeruser(this.user);
          }
        } else if (process.env.VUE_APP_DEFAULT_AUTH === "authapi") {
          axios
            .post("http://127.0.0.1:8000/api/register", {
              username: this.user.username,
              email: this.user.email,
              password: this.user.password,
            })
            .then((res) => {
              return res;
            });
        }
      }
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
                  <h5 class="text-primary">Free Register</h5>
                  <p>Get your free Skote account now.</p>
                </div>
              </BCol>
              <BCol cols="5" class="align-self-end">
                <img src="@/assets/images/profile-img.png" alt class="img-fluid" />
              </BCol>
            </BRow>
          </div>
          <BCardBody class="pt-0">
            <div>
              <router-link to="/">
                <div class="avatar-md profile-user-wid mb-4">
                  <span class="avatar-title rounded-circle bg-light">
                    <img src="@/assets/images/logo.svg" alt class="rounded-circle" height="34" />
                  </span>
                </div>
              </router-link>
            </div>

            <BAlert v-model="registerSuccess" class="mt-3" variant="success" dismissible>Registration successfull.
            </BAlert>

            <BAlert v-model="isRegisterError" class="mt-3" variant="danger" dismissible>{{ regError }}</BAlert>

            <div v-if="notification.message" :class="'alert ' + notification.type">
              {{ notification.message }}
            </div>

            <BForm class="p-2" @submit.prevent="tryToRegisterIn">
              <BFormGroup class="mb-3" id="email-group" label="Username" label-for="username">
                <BFormInput id="username" v-model="user.username" type="text" placeholder="Enter username" :class="{
                  'is-invalid': submitted && v$.user.username.$error,
                }"></BFormInput>
                <div v-if="submitted && v$.user.username.$error" class="invalid-feedback">
                  <span v-if="v$.user.username.required.$message">{{
                    v$.user.username.required.$message
                  }}</span>
                </div>
              </BFormGroup>

              <BFormGroup class="mb-3" id="fullname-group" label="Email" label-for="email">
                <BFormInput id="email" v-model="user.email" type="email" placeholder="Enter email" :class="{
                  'is-invalid': submitted && v$.user.email.$error,
                }"></BFormInput>
                <div v-for="(item, index) in v$.user.email.$errors" :key="index" class="invalid-feedback">
                  <span v-if="item.$message">{{ item.$message }}</span>
                </div>
              </BFormGroup>

              <BFormGroup class="mb-3" id="password-group" label="Password" label-for="password">
                <BFormInput id="password" v-model="user.password" type="password" placeholder="Enter password" :class="{
                  'is-invalid': submitted && v$.user.password.$error,
                }"></BFormInput>
                <div v-if="submitted && v$.user.password.$error" class="invalid-feedback">
                  <span v-if="v$.user.password.required.$message">{{
                    v$.user.password.required.$message
                  }}</span>
                </div>
              </BFormGroup>

              <div class="mt-4 d-grid">
                <BButton type="submit" variant="primary" class="btn-block">Register</BButton>
              </div>

              <div class="mt-4 text-center">
                <h5 class="font-size-14 mb-3">Sign up using</h5>

                <ul class="list-inline">
                  <li class="list-inline-item">
                    <BLink href="javascript: void(0);" class="
                        social-list-item
                        bg-primary
                        text-white
                        border-primary
                      ">
                      <i class="mdi mdi-facebook"></i>
                    </BLink>
                  </li>
                  <li class="list-inline-item">
                    <BLink href="javascript: void(0);" class="social-list-item bg-info text-white border-info">
                      <i class="mdi mdi-twitter"></i>
                    </BLink>
                  </li>
                  <li class="list-inline-item">
                    <BLink href="javascript: void(0);" class="
                        social-list-item
                        bg-danger
                        text-white
                        border-danger
                      ">
                      <i class="mdi mdi-google"></i>
                    </BLink>
                  </li>
                </ul>
              </div>

              <div class="mt-4 text-center">
                <p class="mb-0">
                  By registering you agree to the Skote
                  <BLink href="javascript: void(0);" class="text-primary">Terms of Use</BLink>
                </p>
              </div>
            </BForm>
          </BCardBody>
        </BCard>

        <div class="mt-5 text-center">
          <p>
            Already have an account ?
            <router-link to="/login" class="fw-medium text-primary">Login</router-link>
          </p>
          <p>
            © {{ new Date().getFullYear() }} Skote. Crafted with
            <i class="mdi mdi-heart text-danger"></i> by Themesbrand
          </p>
        </div>
      </BCol>
    </BRow>
  </Layout>
</template>