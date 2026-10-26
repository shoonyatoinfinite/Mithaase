/**
 * Shared WhatsApp & Customer Phone Normalization and Validation Utility
 * Used universally across client forms and server-side route handlers.
 * 
 * IMPORTANT REALITY NOTE:
 * Syntax, format, and carrier validation DOES NOT prove WhatsApp reachability.
 * A number can be structurally valid Indian mobile (+91) but never registered on WhatsApp.
 * Only a delivered and correctly entered WhatsApp OTP proves reachability and ownership.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneErrorCode =
  | "EMPTY_PHONE"
  | "INVALID_LENGTH"
  | "INVALID_PREFIX"
  | "DUMMY_REPEATED"
  | "DUMMY_SEQUENTIAL"
  | "CARRIER_INVALID";

export interface PhoneValidationSuccess {
  isValid: true;
  dbFormat: string; // 10-digit format for Neon DB: "9876543210"
  waFormat: string; // International WhatsApp format: "919876543210"
  formattedDisplay: string; // "+91 98765 43210"
}

export interface PhoneValidationFailure {
  isValid: false;
  error: string;
  code: PhoneErrorCode;
}

export type PhoneValidationResult = PhoneValidationSuccess | PhoneValidationFailure;

// Known dummy / placeholder test patterns that attackers or testing scripts commonly inject
const REPEATED_DIGIT_REGEX = /^([6-9])\1{9}$/;
const SEQUENTIAL_ASCENDING = "0123456789";
const SEQUENTIAL_DESCENDING = "9876543210";

/**
 * Normalizes and validates Indian mobile numbers for WhatsApp verification and DB storage.
 * @param raw Input string from user or request body (e.g. "+91 98290-12345", "09829012345", "9829012345")
 */
export function normalizeAndValidateWhatsAppPhone(raw?: string | null): PhoneValidationResult {
  if (!raw || typeof raw !== "string") {
    return {
      isValid: false,
      error: "Phone number is required.",
      code: "EMPTY_PHONE",
    };
  }

  // 1. Strip all non-numeric characters (spaces, dashes, parentheses, plus)
  let digits = raw.replace(/[^0-9]/g, "");

  // 2. Strip leading country code (+91 / 91) if 12 digits, or leading 0 if 11 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 3. Length verification (must be exactly 10 digits for Indian mobile)
  if (digits.length !== 10) {
    return {
      isValid: false,
      error: "Mobile number must be exactly 10 digits (e.g. 9876543210).",
      code: "INVALID_LENGTH",
    };
  }

  // 4. Prefix verification (TRAI standards require mobile numbers to start with 6, 7, 8, or 9)
  if (!/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      error: "Valid Indian mobile numbers must start with 6, 7, 8, or 9.",
      code: "INVALID_PREFIX",
    };
  }

  // 5. Reject repeated dummy numbers (e.g. 9999999999, 8888888888, 7777777777, 6666666666)
  if (REPEATED_DIGIT_REGEX.test(digits)) {
    return {
      isValid: false,
      error: "Please enter a real mobile number. Repeated test numbers are not accepted.",
      code: "DUMMY_REPEATED",
    };
  }

  // 6. Reject common sequential dummy sequences
  if (digits === SEQUENTIAL_DESCENDING || digits === SEQUENTIAL_ASCENDING) {
    return {
      isValid: false,
      error: "Please enter a genuine mobile number. Sequential test numbers are not allowed.",
      code: "DUMMY_SEQUENTIAL",
    };
  }

  // 7. Rigorous carrier and metadata verification using libphonenumber-js
  try {
    const parsed = parsePhoneNumberFromString(digits, "IN");
    if (!parsed || !parsed.isValid()) {
      return {
        isValid: false,
        error: "This phone number is not recognized as a valid Indian mobile number.",
        code: "CARRIER_INVALID",
      };
    }

    const type = parsed.getType();
    // Accept MOBILE or FIXED_LINE_OR_MOBILE (standard Indian cellular ranges)
    if (type && type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") {
      return {
        isValid: false,
        error: "Landline numbers cannot receive WhatsApp verification codes. Please provide a mobile number.",
        code: "CARRIER_INVALID",
      };
    }

    const nationalNumber = parsed.nationalNumber; // 10 digits
    const dbFormat = nationalNumber;
    const waFormat = `91${nationalNumber}`;
    const formattedDisplay = parsed.formatNational(); // e.g. "098765 43210" -> normalize to "+91 XXXXX XXXXX"

    return {
      isValid: true,
      dbFormat,
      waFormat,
      formattedDisplay: `+91 ${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`,
    };
  } catch {
    return {
      isValid: false,
      error: "Failed to validate mobile number with carrier rules.",
      code: "CARRIER_INVALID",
    };
  }
}
