import { useDispatch, useSelector } from "react-redux";
// import Header from "./components/Header/Header.jsx";
import { useEffect, useState } from "react";
import authService from "./services/Auth.js";
import Loader from "./components/Loader.jsx";
import { login, logout } from "./app/authslice";
import { Outlet ,useLocation} from "react-router-dom";
import API from "./api/axios.js";

function App() {
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const location = useLocation();
  const hideHeader = location.pathname === "/";

  useEffect(() => {
    const token = localStorage.getItem("accessToken");

    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      authService
        .getCurrentUser()
        .then((userData) => {
          if (userData) dispatch(login(userData));
          else {
            dispatch(logout());
            localStorage.removeItem("accessToken");
          }
        })
        .catch(() => {
          dispatch(logout());
          localStorage.removeItem("accessToken");
        })
        .finally(() => setLoading(false));
    } else {
      dispatch(logout());
      setLoading(false);
    }
  }, [dispatch]);

  return (
    <div className="flex flex-wrap content-between ">
      <div className="w-full block">
        {/* {!hideHeader && <Header />} */}
        <main className="">
          {loading?<Loader/>:<Outlet />}
        </main>
      </div>
    </div>
  );
}
export default App;