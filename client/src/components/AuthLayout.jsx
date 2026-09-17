import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { myAttempts } from "../api/attempts";
import toast from "react-hot-toast";
import authService from "../services/Auth";
import { login } from "../app/authslice";
import { setRole } from "../app/roleslice";
import storage from "../app/storage";

// Spinner Component
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col justify-center items-center bg-[#0f0f1c] text-white space-y-4">
    <div className="flex space-x-3">
      <div className="h-5 w-5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="h-5 w-5 bg-green-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="h-5 w-5 bg-purple-500 rounded-full animate-bounce"></div>
    </div>
    <p className="text-lg">"Generating testcases... Verifying against hidden inputs... 🙃"</p>
  </div>
);

// Route guard: checks token and auth state before redirecting anywhere
export const Protected = ({ children, authentication = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const authStatus = useSelector((state) => state.auth.status);
  const role = useSelector((state) => state.role?.role || state.auth?.userData?.role);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    // Check if user has token before redirecting anywhere
    const hasToken = authService.isLoggedIn();
    const token = authService.getAccessToken();

    // 1. Protected route (requires login)
    if (authentication) {
      if (!hasToken && !authStatus) {
        // Truly unauthenticated (no token or expired) -> redirect to login
        navigate("/", { replace: true });
        setLoader(false);
        return;
      }

      // User has token: ensure auth header is attached & hydrate redux if not yet synced
      if (hasToken && token) {
        authService.setAuthHeader(token);
        if (!authStatus) {
          const cachedAuth = storage.get("auth");
          if (cachedAuth?.userData) {
            dispatch(login({ user: cachedAuth.userData, accessToken: token }));
            dispatch(setRole(cachedAuth.userData.role || authService.getRole() || "user"));
          }
        }
      }

      // If student user has an ongoing test in progress, always redirect to it
      if (
        role !== "admin" &&
        !location.pathname.startsWith("/attempt/") &&
        !location.pathname.startsWith("/review/")
      ) {
        myAttempts({ limit: 10 })
          .then((res) => {
            const atts = res.data.statusCode?.attempts || [];
            const ongoing = atts.find((a) => a.status === "in_progress");
            if (ongoing) {
              const firstProb =
                ongoing.questionSetId?.problems?.[0]?._id ||
                ongoing.questionSetId?.problems?.[0] ||
                "";
              toast("You have an ongoing test in progress. Redirecting...", { icon: "⚡" });
              navigate(`/attempt/${ongoing._id}/problem/${firstProb}`, { replace: true });
              return;
            }
            setLoader(false);
          })
          .catch(() => {
            setLoader(false);
          });
      } else {
        setLoader(false);
      }
      return;
    }

    // 2. Guest-only route (authentication === false, e.g. /login or /register)
    // Check if user has token so that no unnecessary login again
    if (!authentication) {
      if (hasToken || authStatus) {
        if (
          role !== "admin" &&
          !location.pathname.startsWith("/attempt/") &&
          !location.pathname.startsWith("/review/")
        ) {
          myAttempts({ limit: 10 })
            .then((res) => {
              const atts = res.data.statusCode?.attempts || [];
              const ongoing = atts.find((a) => a.status === "in_progress");
              if (ongoing) {
                const firstProb =
                  ongoing.questionSetId?.problems?.[0]?._id ||
                  ongoing.questionSetId?.problems?.[0] ||
                  "";
                toast("You have an ongoing test in progress. Redirecting...", { icon: "⚡" });
                navigate(`/attempt/${ongoing._id}/problem/${firstProb}`, { replace: true });
                return;
              }
              navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
            })
            .catch(() => {
              navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
            });
        } else {
          navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
        }
        return;
      }

      // No token -> allow showing login/register
      setLoader(false);
    }
  }, [authentication, authStatus, role, location.pathname, navigate, dispatch]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};

// Route guard: requires admin role
export const Secured = ({ children, requiredRole = "admin" }) => {
  const navigate = useNavigate();
  const role = useSelector((state) => state.role?.role || state.auth?.userData?.role);
  const authStatus = useSelector((state) => state.auth.status);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    // Check if user has token before redirecting anywhere
    const hasToken = authService.isLoggedIn();

    if (!hasToken && !authStatus) {
      navigate("/", { replace: true });
      setLoader(false);
      return;
    }

    const currentRole = role || authService.getRole();
    if (currentRole !== requiredRole) {
      toast.error("Access denied: Admin privileges required.");
      navigate("/dashboard", { replace: true });
      setLoader(false);
      return;
    }

    setLoader(false);
  }, [role, requiredRole, authStatus, navigate]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};