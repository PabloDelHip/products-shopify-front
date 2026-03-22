import { defineStore } from "pinia";
import { getFirebaseBackend } from "../../authUtils";
import syscomService from "../../services/syscom";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    currentUser: sessionStorage.getItem("authUser"),
  }),
  getters: {
    loggedIn() {
      return !!this.currentUser;
    },
  },
  actions: {
    logIn({ email, password }) {
      return getFirebaseBackend()
        .loginUser(email, password)
        .then(async () => {
          try {
            await syscomService.authenticate();
          } catch (error) {
            console.error("Error al autenticar con Syscom:", error);
          }
          this.validate();
        });
    },
    validate() {
      if (!this.currentUser) {
        return Promise.resolve({});
      }
      const user = getFirebaseBackend().getAuthenticatedUser();
      this.setUser(user);

      return Promise.resolve(user);
    },
    setUser(user) {
      this.currentUser = user;
      this.saveState("auth.currentUser", user);
    },
    saveState(key, state) {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    },
    register({ username, email, password } = {}) {
      return getFirebaseBackend()
        .registerUser(username, email, password)
        .then((response) => {
          const user = response;
          // this.setUser(user)
          this.validate();
          return user;
        });
    },
    resetPassword({ email } = {}) {
      return getFirebaseBackend()
        .forgetPassword(email)
        .then((response) => {
          const message = response.data;
          this.validate();

          return message;
        });
    },
    logOut() {
      this.setUser(null);
      return new Promise((resolve, reject) => {
        getFirebaseBackend()
          .logout()
          .then(() => {
            resolve(true);
          })
          .catch((error) => {
            reject(this._handleError(error));
          });
      });
    },
  },
});
