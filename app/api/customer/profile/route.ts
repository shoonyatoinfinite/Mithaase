import { NextResponse } from "next/server";
import { findCustomerByEmail, updateCustomerProfile } from "@/lib/data/store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const customer = await findCustomerByEmail(email);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const { pin: _pin, password: _password, ...safeCustomer } = customer;
    return NextResponse.json(safeCustomer);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch customer profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      name,
      phone,
      password,
      pin,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
    } = body;
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

    // Note: Email cannot be changed as per requirement
    const result = await updateCustomerProfile(email, {
      name,
      phone,
      password,
      pin,
      delivery_address,
      locality,
      landmark,
      delivery_instructions,
      latitude,
      longitude,
      map_url,
    });

    if (!result.success || !result.customer) {
      return NextResponse.json({ error: result.error || "Failed to update profile" }, { status: 400 });
    }

    const { pin: _pin, password: _password, ...safeCustomer } = result.customer;
    return NextResponse.json({ success: true, customer: safeCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update customer profile" }, { status: 500 });
  }
}
