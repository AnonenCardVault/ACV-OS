import { NextResponse, type NextRequest } from "next/server";
import { computeMarketplaceDeletionChallengeResponse, getEbayDeletionConfig, markMarketplaceDeletionChallengeVerified } from "@/lib/ebay/notifications/challenge";
import { processEbayMarketplaceAccountDeletion } from "@/lib/ebay/compliance/process-account-deletion";
import { shouldProcessEbayDeletionNotification } from "@/lib/ebay/notifications/idempotency";
import { recordEbayDeletionNotification } from "@/lib/ebay/notifications/notification-store";
import { parseEbayDeletionPayload, validateEbayDeletionPayload } from "@/lib/ebay/notifications/validate-notification";
import { verifyEbayNotificationSignature } from "@/lib/ebay/notifications/verify-notification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 256 * 1024;

function json(data: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function devLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[ACV eBay Account Deletion Route] ${message}`, payload || {});
  }
}

function configOrError() {
  const config = getEbayDeletionConfig();
  if (!config.configured) {
    return {
      config,
      response: json(
        {
          error: "eBay Marketplace Account Deletion endpoint is misconfigured.",
          missing: config.missing
        },
        { status: 500 }
      )
    };
  }

  return { config, response: null };
}

export async function GET(request: NextRequest) {
  const { config, response } = configOrError();
  if (response) return response;

  const challengeCode = request.nextUrl.searchParams.get("challenge_code")?.trim() || "";
  if (!challengeCode) {
    return json({ error: "Missing required challenge_code query parameter." }, { status: 400 });
  }

  const challengeResponse = computeMarketplaceDeletionChallengeResponse({
    challengeCode,
    verificationToken: config.verificationToken,
    endpointUrl: config.endpointUrl
  });

  devLog("GET challenge verified", {
    endpointConfigured: Boolean(config.endpointUrl),
    receivedAt: new Date().toISOString()
  });
  markMarketplaceDeletionChallengeVerified();

  return json({ challengeResponse }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxBodyBytes) {
    return json({ error: "Request body is too large." }, { status: 413 });
  }

  try {
    const payload = validateEbayDeletionPayload(parseEbayDeletionPayload(rawBody));
    const verification = await verifyEbayNotificationSignature({
      rawBody,
      signature: request.headers.get("x-ebay-signature"),
      payload
    });

    if (!verification.verified) {
      await recordEbayDeletionNotification({
        payload,
        signatureVerified: false,
        status: "failed",
        errorMessage: verification.message
      }).catch((error) => {
        devLog("could not record rejected notification", {
          notificationId: payload.notificationId,
          error: error instanceof Error ? error.message : String(error)
        });
      });

      return json(
        {
          error: "Notification signature could not be verified.",
          message: verification.message
        },
        { status: verification.status }
      );
    }

    const { row, duplicate } = await recordEbayDeletionNotification({
      payload,
      signatureVerified: true,
      status: "verified"
    });

    if (shouldProcessEbayDeletionNotification(row, duplicate)) {
      await processEbayMarketplaceAccountDeletion(row);
    }

    devLog("POST notification accepted", {
      notificationId: payload.notificationId,
      duplicate
    });

    return json(
      {
        status: duplicate ? "duplicate-accepted" : "accepted",
        notificationId: payload.notificationId
      },
      { status: 202 }
    );
  } catch (error) {
    return json(
      {
        error: "Invalid eBay Marketplace Account Deletion notification.",
        message: error instanceof Error ? error.message : "Notification could not be processed."
      },
      { status: 400 }
    );
  }
}
