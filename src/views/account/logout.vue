<script>
import Layout from "../../layouts/auth";

/**
 * Login component
 */
export default {
  components: {
    Layout,
  },
  mounted() {
    localStorage.clear();
    sessionStorage.clear()

    window.location.href = "/login"
    this.$router.push({ name: 'login' })
  },
};
</script>

<template>
  <Layout>
  </Layout>
</template>