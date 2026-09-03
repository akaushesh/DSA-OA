import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { myAttempts } from "../api/attempts";
import toast from "react-hot-toast";

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

// Route guard: requires user to be logged in and redirects to active test if in progress
export const Protected = ({ children, authentication = true }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authStatus = useSelector((state) => state.auth.status);
  const role = useSelector((state) => state.role.role);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    if (authStatus !== authentication) {
      navigate("/");
      setLoader(false);
      return;
    }

    // If student user has an ongoing test in progress, always redirect to it
    if (
      authStatus &&
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
  }, [authentication, authStatus, role, location.pathname, navigate]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};

// Route guard: requires admin role
export const Secured = ({ children, requiredRole = "admin" }) => {
  const navigate = useNavigate();
  const role = useSelector((state) => state.role.role);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    if (role !== requiredRole) {
      navigate("/home");
    }
    setLoader(false);
  }, [role, requiredRole, navigate]);

  return loader ? <LoadingScreen /> : <>{children}</>;
};