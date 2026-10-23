"use client";

import React from "react";
import { useUserAuth } from "@/lib/context/user-auth-context";
import { CustomerAuthPortal } from "@/components/auth/CustomerAuthPortal";

export function CustomerAuthModal() {
  const { isAuthModalOpen, closeAuthModal, handlePostLoginRedirect } = useUserAuth();

  if (!isAuthModalOpen) return null;

  const handleSuccess = () => {
    closeAuthModal();
    handlePostLoginRedirect();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md my-auto animate-in fade-in zoom-in-95 duration-200">
        <CustomerAuthPortal
          mode="modal"
          onClose={closeAuthModal}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}
