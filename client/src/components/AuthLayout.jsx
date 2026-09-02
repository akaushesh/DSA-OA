import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

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

// Route guard: requires user to be logged in
export const Protected = ({ children, authentication = true }) => {
  const navigate = useNavigate();
  const authStatus = useSelector((state) => state.auth.status);
  const [loader, setLoader] = useState(true);

  useEffect(() => {
    if (authStatus !== authentication) {
      navigate("/");
    }
    setLoader(false);
  }, [authentication, authStatus, navigate]);

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