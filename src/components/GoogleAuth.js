// App.js
import React from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GoogleAuth = () => {
  const handleLoginSuccess = (credentialResponse) => {
    console.log("Login Success: ", credentialResponse);
    // Send the credential to your backend for verification and session handling
  };

  const handleLoginFailure = () => {
    console.log("Login Failed");
  };

  return (
    <GoogleOAuthProvider clientId="47439091557-2kdm5q9pi6lm0d2n3pvtvb6vr9p69h4h.apps.googleusercontent.com">
      <div className="App">
        <h1>Sign In with Google</h1>
        <GoogleLogin
          onSuccess={handleLoginSuccess}
          onError={handleLoginFailure}
        />
      </div>
    </GoogleOAuthProvider>
  );
};

export default GoogleAuth;
