# Tier 1: Data Enforcement — Test Cases & Validation Rules

## 📋 Enforcement Rules Implemented

### **Rule 1: Auto-Update lastActivityDate**

**Implementation:** Mongoose pre-hooks on save, findByIdAndUpdate, updateOne, updateMany

**Behavior:**
- Every time an enquiry is created, updated, or modified → `lastActivityDate` automatically set to current time
- User CANNOT manually override this during normal updates
- `lastActivityDate` is ALWAYS current (prevents stale data)

**Test Cases:**

```bash
# Test 1.1: Create enquiry → lastActivityDate set automatically
POST /api/enquiries
{
  "enquiryNo": "ENQ-TEST-001",
  "enquiryDate": "2024-01-15",
  "customerId": "67abc123def456...",
  "items": [{
    "productName": "Widget A",
    "quantity": 10
  }]
}

✅ Expected: Response includes lastActivityDate = current timestamp
✅ Verify: GET /api/enquiries/[id] → lastActivityDate is set


# Test 1.2: Update enquiry status → lastActivityDate updates automatically
PUT /api/enquiries/[id]
{
  "status": "Contacted",
  "probability": 50
}

✅ Expected: lastActivityDate = new current timestamp (not old)
✅ Verify: Compare before/after timestamps → should be different


# Test 1.3: Multiple updates → lastActivityDate reflects latest
PUT /api/enquiries/[id]
{ "probability": 60 }

(wait 2 seconds)

PUT /api/enquiries/[id]
{ "probability": 70 }

✅ Expected: Second update has later lastActivityDate than first
```

---

### **Rule 2: Enforce lossReason When Status = Lost**

**Implementation:** 
- Validation middleware `validateEnquiryUpdate`
- Controller-level check in updateEnquiry
- Pre-validation on route

**Behavior:**
- If you try to set status = "Lost" WITHOUT providing lossReason → **REQUEST REJECTED**
- Valid lossReasons: `['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']`
- If you provide lossReason but status ≠ Lost → allowed but logged as warning

**Test Cases:**

```bash
# Test 2.1: Try to mark Lost WITHOUT lossReason → REJECTED ❌
PUT /api/enquiries/[id]
{
  "status": "Lost"
}

✅ Expected: 400 Bad Request
✅ Response: 
{
  "message": "lossReason is required when status is \"Lost\"",
  "requiredField": "lossReason",
  "validValues": [...]
}


# Test 2.2: Mark Lost WITH valid lossReason → ACCEPTED ✅
PUT /api/enquiries/[id]
{
  "status": "Lost",
  "lossReason": "High Price"
}

✅ Expected: 200 OK
✅ Verify: GET /api/enquiries/[id] → status = "Lost", lossReason = "High Price"


# Test 2.3: Try invalid lossReason → REJECTED ❌
PUT /api/enquiries/[id]
{
  "status": "Lost",
  "lossReason": "InvalidReason"
}

✅ Expected: 400 Bad Request
✅ Response: Invalid lossReason value


# Test 2.4: Provide lossReason without changing to Lost → ALLOWED (with warning) ⚠️
PUT /api/enquiries/[id]
{
  "status": "Negotiation",
  "lossReason": "High Price"
}

✅ Expected: 200 OK (allowed)
✅ Check backend logs: Warning about lossReason on non-Lost status


# Test 2.5: Update Lost enquiry with different lossReason → ALLOWED ✅
PUT /api/enquiries/[id]
{
  "status": "Lost",
  "lossReason": "Slow Delivery"
}

✅ Expected: 200 OK
✅ Verify: lossReason updated to "Slow Delivery"
```

---

### **Rule 3: Validate assignedTo (User ID)**

**Implementation:** 
- Validation middleware `validateEnquiryUpdate`
- MongoDB ObjectId format check

**Behavior:**
- If `assignedTo` is provided, it must be a valid MongoDB ObjectId
- If invalid ObjectId format → **REQUEST REJECTED**
- Field is optional (can be null or omitted)

**Test Cases:**

```bash
# Test 3.1: Valid assignedTo → ACCEPTED ✅
PUT /api/enquiries/[id]
{
  "assignedTo": "67abc123def456789xyz1234"
}

✅ Expected: 200 OK
✅ Verify: GET /api/enquiries/[id] → assignedTo is set


# Test 3.2: Invalid ObjectId format → REJECTED ❌
PUT /api/enquiries/[id]
{
  "assignedTo": "not-a-valid-id"
}

✅ Expected: 400 Bad Request
✅ Response: "Invalid assignedTo value. Must be a valid user ID."


# Test 3.3: Valid ObjectId from User collection → ACCEPTED ✅
# Get a real user ID from GET /api/users
PUT /api/enquiries/[id]
{
  "assignedTo": "[REAL_USER_ID_FROM_DB]"
}

✅ Expected: 200 OK
✅ Verify: assignedTo is set to that user


# Test 3.4: Null/empty assignedTo → ACCEPTED ✅
PUT /api/enquiries/[id]
{
  "assignedTo": null
}

✅ Expected: 200 OK (optional field)
```

---

### **Rule 4: Prevent Null Critical Fields**

**Implementation:** Validation middleware `validateCriticalFields`

**Behavior:**
- Cannot set `customerId`, `enquiryNo`, or `enquiryDate` to null/empty
- These are foundation fields

**Test Cases:**

```bash
# Test 4.1: Try to remove customerId → REJECTED ❌
PUT /api/enquiries/[id]
{
  "customerId": null
}

✅ Expected: 400 Bad Request
✅ Response: "Customer ID cannot be removed"


# Test 4.2: Try to remove enquiryNo → REJECTED ❌
PUT /api/enquiries/[id]
{
  "enquiryNo": ""
}

✅ Expected: 400 Bad Request
✅ Response: "Enquiry number cannot be changed"


# Test 4.3: Update other fields while keeping critical fields → ACCEPTED ✅
PUT /api/enquiries/[id]
{
  "probability": 80,
  "status": "Quotation Received"
  // customerId, enquiryNo, enquiryDate not included → stays unchanged
}

✅ Expected: 200 OK
```

---

### **Rule 5: lastActivityDate Cannot Be Manual Future Date**

**Implementation:** Validation middleware `validateActivityDate`

**Behavior:**
- User cannot manually set lastActivityDate to a future date
- Can set to past dates (for corrections), but not future

**Test Cases:**

```bash
# Test 5.1: Try to set future date → REJECTED ❌
PUT /api/enquiries/[id]
{
  "lastActivityDate": "2099-12-31"
}

✅ Expected: 400 Bad Request
✅ Response: "lastActivityDate cannot be set to a future date"


# Test 5.2: Set to past date (correction) → ACCEPTED ✅
PUT /api/enquiries/[id]
{
  "lastActivityDate": "2024-01-01"
}

✅ Expected: 200 OK (allowed for corrections)
```

---

## 🧪 Full Integration Test Sequence

**Run this sequence to validate all enforcement rules:**

```bash
# 1. Create enquiry
POST /api/enquiries
{
  "enquiryNo": "ENFORCE-TEST-001",
  "enquiryDate": "2024-01-15",
  "customerId": "[REAL_CUSTOMER_ID]",
  "items": [{"productName": "Test Product", "quantity": 5}]
}
SAVE_ID = response._id
SAVE_TIMESTAMP = response.lastActivityDate

# 2. Verify lastActivityDate was set
GET /api/enquiries/$SAVE_ID
✅ Check: lastActivityDate exists and equals creation time

# 3. Update status (not Lost) — should work
PUT /api/enquiries/$SAVE_ID
{
  "status": "Contacted",
  "probability": 40
}
✅ Check: status changed, lastActivityDate updated (newer than $SAVE_TIMESTAMP)

# 4. Try to mark Lost without lossReason — should FAIL
PUT /api/enquiries/$SAVE_ID
{
  "status": "Lost"
}
✅ Expect 400 error

# 5. Mark Lost WITH lossReason — should WORK
PUT /api/enquiries/$SAVE_ID
{
  "status": "Lost",
  "lossReason": "High Price"
}
✅ Check: lossReason saved

# 6. Verify data integrity
GET /api/enquiries/$SAVE_ID
✅ Check: 
  - status = "Lost"
  - lossReason = "High Price"
  - lastActivityDate = recent timestamp
  - customerId = unchanged
  - enquiryNo = unchanged
```

---

## 📊 Enforcement Summary

| Rule | Enforced | Test Coverage | Status |
|------|----------|---|--------|
| Auto-update lastActivityDate | ✅ Yes (Mongoose hooks) | 3 tests | READY |
| lossReason required on Lost | ✅ Yes (Middleware + Controller) | 5 tests | READY |
| assignedTo validation | ✅ Yes (Middleware) | 4 tests | READY |
| Prevent null critical fields | ✅ Yes (Middleware) | 3 tests | READY |
| No future activity dates | ✅ Yes (Middleware) | 2 tests | READY |

---

## 🚀 How to Test

**Option A: Manual Postman Testing**
1. Use Postman collection
2. Run test cases 1.1 through 5.2
3. Verify responses match expected

**Option B: Automated Testing**
```bash
cd backend
npm test -- tests/tier1-enforcement.test.js
```

**Option C: During Phase 1-11 Testing Checklist**
- Include these enforcement checks in "Phase 10: Filters & Export"
- Add sub-checks for data validation errors

---

## ✅ Tier 1 Complete When

- ✅ All 5 rules enforced in code
- ✅ All test cases pass
- ✅ No enforcement errors in production flow
- ✅ Analytics shows consistent data (no nulls, no invalid states)
