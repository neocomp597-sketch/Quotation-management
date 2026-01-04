
# 📘 User & Administrator Guide - JAG Quotation Management System

Welcome to the **JAG Quotation Management System**. This guide provides a comprehensive overview of how to use the software to check inventory, manage customers, and generate professional sales quotations.

---

## 🚀 1. Getting Started

### Access the System
*   **Web URL**: `http://localhost:5173` (or your production URL)
*   **Login**: Enter your registered Email and Password.

### User Roles
The system has two types of users:
1.  **Administrators (Admin)**: Have full access to **all** data in the system. Can view all quotations, customers, and manage sales staff.
2.  **Salespersons**: Can only view and manage **their own** customers and quotations. They cannot see data created by other sales staff.

---

## 📊 2. Dashboard

Upon logging in, you are greeted by the Dashboard. This is your command center.

*   **Key Metrics**:
    *   **Total Quotations**: The count of all quotes generated (by you or everyone, depending on role).
    *   **Draft Quotes**: Quotes currently being worked on.
    *   **Business Pipeline**: The total monetary value of all quotations.
    *   **Registered Customers**: Total number of clients in your database.
*   **Recent Quotations**: A quick list of the last 5 quotations for easy access.

---

## 👥 3. Managing Customers

Before creating a quote, you usually need a customer.

### Adding a Customer
1.  Navigate to **Customers** in the sidebar.
2.  Click **+ Add Customer**.
3.  Fill in the details:
    *   **Company Name** & **GSTIN**: Vital for tax invoices.
    *   **Billing & Shipping Address**: Used for GST calculation.
    *   **Discount**: You can set a default discount % for this client.
4.  **Important**: The **State** in the Billing Address determines tax type (IGST vs CGST/SGST). The system assumes the business is based in **Maharashtra**.
    *   Same State (Maharashtra) → **CGST + SGST**
    *   Different State → **IGST**

---

## 📦 4. Managing Products (Inventory)

The **Products** section is your catalog.

*   **View Products**: Browse your item list with images, codes, and base prices.
*   **Search**: Quickly find products by Name or Code.
*   **Details**: Each product holds:
    *   **Base Price**: The price *before* tax.
    *   **GST %**: The tax bracket (e.g., 18%, 28%).
    *   **HSN Code**: Required for compliance.

---

## 📝 5. Creating a Quotation (Workflow)

This is the core feature of the application.

### Step 1: General Info
*   Go to **Quotations** -> **New Quotation**.
*   **Select Customer**: Search and select a client. Their address and GST details will auto-load.
*   **Salesperson**: Assign a sales rep (Defaults to you).
*   **Payment Terms**: Select valid terms (e.g., "15 Days Credit").

### Step 2: Add Products
*   Click **Add Product**.
*   Search for an item in the catalog.
*   **Quantity & Logic**:
    *   Updates to Quantity or Rate auto-recalculate the **Line Total**.
    *   **Discount %**: Applied to the base rate *before* tax.

### Step 3: Terms & Conditions
*   **Templates**: Select a pre-saved template (e.g., "Standard Sanitaryware T&C") to auto-fill the text.
*   **Custom**: You can edit the text manually for specific deals.

### Step 4: Final Review
*   **Financial Audit**: On the right (or bottom on mobile), check the summary.
    *   **Subtotal**: Value of goods.
    *   **GST**: Auto-calculated tax sum.
    *   **Grand Total**: Final payable amount (with auto round-off).
*   **Additional Discount**: You can apply a fixed lump-sum discount to the final total.

### Step 5: Save
*   **Save Draft**: Saves work without finalizing. You can edit it later.
*   **Finalize**: Locks the quotation. It is marked as 'Final' and ready for the customer.

---

## 📄 6. PDF Generation

You can download a professional PDF for any quotation.
1.  Go to the **Quotations List** or the **Dashboard**.
2.  Click the **PDF Icon** next to any quotation.
3.  The system generates a PDF containing:
    *   Your Company Header/Logo.
    *   Customer Details.
    *   Itemized List with HSN, Tax, and Pricing.
    *   Bank Details & Terms.
    *   **Authorized Signatory** area.

---

## ⚙️ 7. System Settings & Profile

*   **Profile**: Click your user icon in the top right -> **Profile Settings**.
    *   View your registered Name, Email, and Role.
*   **Salespersons (Admin Only)**: Admins can view a list of all registered users in the **Salespersons** tab.

---

## 🛠 8. Technical Support

If you encounter issues:
1.  **Logout/Login**: Retry your session.
2.  **Contact Admin**: If you cannot see a customer or quote, ensure you are logged into the correct account. Data privacy rules may be hiding it.

---

**Built for Jaguar ERP**
Design version: 1.2
Confirmed Environment: Production / Local
