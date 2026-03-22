<script>
import axios from "axios";

import Layout from "../../layouts/auth";

import { required, email, helpers } from "@vuelidate/validators";
import useVuelidate from "@vuelidate/core";

import { useAuthStore } from '@/state/pinia'
const auth = useAuthStore()

/**
 * Forgot Password component
 */
export default {
  setup() {
    return { v$: useVuelidate() };
  },
  validations: {
    email: {
      required: helpers.withMessage("Email is required", required),
      email: helpers.withMessage("Please enter valid email", email),
    },
  },
  components: {
    Layout,
  },
  data() {
    return {
      email: "",
      submitted: false,
      error: null,
      tryingToReset: false,
      isResetError: false,
    };
  },
  methods: {
    // Try to register the user in with the email, fullname
    // and password they provided.
    tryToReset() {
      this.submitted = true;
      // stop here if form is invalid
      this.v$.$touch();

      if (this.v$.$invalid) {
        return;
      } else {
        if (process.env.VUE_APP_DEFAULT_AUTH === "firebase") {
          this.tryingToReset = true;
          // Reset the authError if it existed.
          this.error = null;
          auth.resetPassword({ email: this.email })
            .then(() => {
              this.tryingToReset = false;
              this.isResetError = false;
            })
            .catch((error) => {
              this.tryingToReset = false;
              this.error = error ? error : "";
              this.isResetError = true;
            })
        } else if (process.env.VUE_APP_DEFAULT_AUTH === "authapi") {
          axios
            .post("http://127.0.0.1:8000/api/password/create", {
              email: this.email,
            })
            .then((res) => {
              this.isResetError = true;
              this.error = res.data;
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
                  <h5 class="text-primary">Reset Password</h5>
                  <p>Re-Password with Skote.</p>
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
                    <img src="@/assets/images/logo.svg" alt height="34" />
                  </span>
                </div>
              </router-link>
            </div>

            <div class="p-2">
              <BAlert v-model="isResetError" class="mb-4" variant="danger" dismissible>{{ error }}</BAlert>
              <BForm @submit.prevent="tryToReset">
                <div class="mb-3">
                  <label for="useremail">Email</label>
                  <input type="email" v-model="email" class="form-control" id="useremail" placeholder="Enter email"
                    :class="{ 'is-invalid': submitted && v$.email.$errors }" />
                  <div v-for="(item, index) in v$.email.$errors" :key="index" class="invalid-feedback">
                    <span v-if="item.$message">{{ item.$message }}</span>
                  </div>
                </div>
                <BRow class="mb-3 mb-0">
                  <BCol cols="12" class="text-end">
                    <BButton variant="primary" class="w-md" type="submit">
                      Reset
                    </BButton>
                  </BCol>
                </BRow>
              </BForm>
            </div>
          </BCardBody>
        </BCard>

        <div class="mt-5 text-center">
          <p>
            Remember It ?
            <router-link to="/login" class="fw-medium text-primary">Sign In here</router-link>
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

<style lang="scss" module></style>
