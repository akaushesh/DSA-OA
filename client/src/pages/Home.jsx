import { useState } from "react";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  return (
    <>
      HOME !!!
    </>
  );
}