import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ChakraProvider } from "@chakra-ui/react";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ChakraProvider>
    <div>
      <Toaster />
    </div>
    <App />
  </ChakraProvider>
);
