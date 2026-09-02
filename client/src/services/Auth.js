import API from "../api/axios";

class AuthService {
  async login(username, password) {
    try {
      const res = await API.post("/users/login", { username, password });
      const accessToken = res.data.statusCode.accessToken;
      const user = res.data.statusCode.user;

      this.setAccessToken(accessToken);
      this.setRole(user.role);
      this.setAuthHeader(accessToken);

      return user;
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error(error?.response?.data?.message || "Login failed");
    }
  }
  async signup(fullName, username, password) {
  try {
    await API.post("/users/register", { username, password, fullName });
    return await this.login(username, password);
  } catch (error) {
    console.error("Signup failed:", error);
    throw new Error(error?.response?.data?.message || "Signup failed");
  }
}

  async getCurrentUser() {
    try {
      const res = await API.get("/users/me");
      return res.data.statusCode.user;
    } catch (error) {
      throw new Error(error?.response?.data?.message || "Failed to fetch user");
    }
  }

  async logout() {
    try {
      await API.post("/users/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      this.clearAuthData();
      this.clearCachedData();
    }
  }

  setAuthHeader(token) {
    API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  setAccessToken(token) {
    localStorage.setItem("accessToken", token);
  }

  getAccessToken() {
    return localStorage.getItem("accessToken");
  }

  setRole(role) {
    localStorage.setItem("role", role);
  }

  getRole() {
    return localStorage.getItem("role");
  }

  isAdmin() {
    return this.getRole() === "admin";
  }

  isLoggedIn() {
    return !!this.getAccessToken();
  }

  clearAuthData() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("role");
    delete API.defaults.headers.common["Authorization"];
  }

  clearCachedData() {
    sessionStorage.clear();
  }

}

const authService = new AuthService();
export default authService;