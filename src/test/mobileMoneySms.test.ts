import { describe, expect, it } from "vitest";
import { parseSms, pickProvider, extractBody } from "../../supabase/functions/mm-sms-webhook/parse.ts";

// Provider-specific TxID formats (confirmed with the owner):
// Telebirr = 10 letters/digits, e.g. DKN0KRZYF4; eBirr = 12 digits, e.g. 802838867703
const TELEBIRR_SMS =
  "You have received ETB 100.00 from 0912345678. Transaction Number: DKN0KRZYF4. New balance ETB 1,250.00";
const EBIRR_SMS =
  "You have received Birr 250.00 from 0987654321 via eBirr. Transaction id: 802838867703";

describe("receiver-phone SMS parsing", () => {
  it("parses a Telebirr payment SMS into amount, 10-char TxID and payer phone", () => {
    expect(parseSms("telebirr", TELEBIRR_SMS)).toEqual({
      amount: 100,
      txid: "DKN0KRZYF4",
      phone: "0912345678",
      provider: "telebirr",
    });
  });

  it("parses an eBirr payment SMS into amount and 12-digit TxID", () => {
    const r = parseSms("ebirr", EBIRR_SMS);
    expect(r?.amount).toBe(250);
    expect(r?.txid).toBe("802838867703");
    expect(r?.phone).toBe("0987654321");
  });

  it("rejects a Telebirr TxID that is all digits (wrong provider format)", () => {
    expect(parseSms("telebirr", "received ETB 100.00 transaction number 1234567890")).toBeNull();
  });

  it("returns null when there is no amount or no transaction id", () => {
    expect(parseSms("telebirr", "Your Telebirr account is now active")).toBeNull();
  });

  it("detects the provider from the sender name", () => {
    expect(pickProvider("telebirr")).toBe("telebirr");
    expect(pickProvider("127")).toBe("telebirr");
    expect(pickProvider("eBirr")).toBe("ebirr");
    expect(pickProvider("0912345678")).toBeNull();
  });

  it("falls back to the message wording when the sender name is missing", () => {
    expect(pickProvider("", "Telebirr: you have received ETB 100.00")).toBe("telebirr");
    expect(pickProvider("", "eBirr payment received")).toBe("ebirr");
    expect(pickProvider("", "Your bus arrives in 127 minutes")).toBeNull();
  });

  it("reads a form-urlencoded body from the phone forwarder", () => {
    const body = new URLSearchParams({ sender: "telebirr", text: TELEBIRR_SMS }).toString();
    const b = extractBody(body, "application/x-www-form-urlencoded");
    expect(b.sender).toBe("telebirr");
    expect(b.text).toBe(TELEBIRR_SMS);
  });

  it("reads a JSON body and tolerates a newline inside the message text", () => {
    const b = extractBody('{"sender":"telebirr","text":"line one\nline two"}', "application/json");
    expect(b.sender).toBe("telebirr");
    expect(b.text).toBe("line one\nline two");
  });

  it("treats a plain-text body as the message itself", () => {
    const b = extractBody(TELEBIRR_SMS, "text/plain");
    expect(b.text).toBe(TELEBIRR_SMS);
  });
});
