function numberOrNull(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function integerOrNull(value: unknown) {
  const next = Number(value);
  return Number.isInteger(next) ? next : null;
}

function moneyValue(value: unknown) {
  const amount = typeof value === "object" && value ? (value as { value?: unknown }).value : undefined;
  return numberOrNull(amount);
}

function moneyCurrency(value: unknown) {
  const currency = typeof value === "object" && value ? (value as { currency?: unknown }).currency : undefined;
  return typeof currency === "string" ? currency : null;
}

function limitedPayload(payload: unknown) {
  return JSON.parse(JSON.stringify(payload || {}, (_key, value) => {
    if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}...`;
    return value;
  }));
}

export function normalizeInventoryItem(item: Record<string, any>) {
  const product = item.product || {};
  const availability = item.availability || {};
  const shipToLocationAvailability = availability.shipToLocationAvailability || {};
  return {
    sku: String(item.sku || "").trim(),
    product_title: product.title || null,
    description: product.description || null,
    aspects: product.aspects || {},
    image_urls: product.imageUrls || [],
    condition: item.condition || item.conditionDescription || null,
    quantity: integerOrNull(shipToLocationAvailability.quantity),
    package_details: item.packageWeightAndSize || {},
    availability,
    locale: item.locale || null,
    raw_status: item.status || null,
    source_payload: limitedPayload({
      sku: item.sku,
      product,
      availability,
      condition: item.condition,
      packageWeightAndSize: item.packageWeightAndSize,
      locale: item.locale,
      status: item.status
    })
  };
}

export function classifyOffer(offer: Record<string, any>) {
  const status = String(offer.status || offer.offerStatus || "").toUpperCase();
  const listingId = offer.listing?.listingId || offer.listingId || null;
  if (listingId || status === "PUBLISHED") return "published";
  if (status === "WITHDRAWN") return "withdrawn";
  if (status) return status.toLowerCase();
  return "unpublished_offer";
}

export function normalizeOffer(offer: Record<string, any>) {
  const pricingSummary = offer.pricingSummary || {};
  const price = pricingSummary.price || offer.price;
  const listingPolicies = offer.listingPolicies || {};
  return {
    offer_id: String(offer.offerId || "").trim(),
    sku: offer.sku || null,
    listing_id: offer.listing?.listingId || offer.listingId || null,
    offer_status: offer.status || offer.offerStatus || null,
    listing_state: classifyOffer(offer),
    price_value: moneyValue(price),
    price_currency: moneyCurrency(price),
    quantity_limit_per_buyer: integerOrNull(offer.quantityLimitPerBuyer),
    available_quantity: integerOrNull(offer.availableQuantity || offer.quantity),
    category_id: offer.categoryId || null,
    fulfillment_policy_id: listingPolicies.fulfillmentPolicyId || null,
    payment_policy_id: listingPolicies.paymentPolicyId || null,
    return_policy_id: listingPolicies.returnPolicyId || null,
    listing_description: offer.listingDescription || null,
    merchant_location_key: offer.merchantLocationKey || null,
    listing_duration: offer.listingDuration || null,
    include_catalog_product_details: typeof offer.includeCatalogProductDetails === "boolean" ? offer.includeCatalogProductDetails : null,
    source_payload: limitedPayload({
      offerId: offer.offerId,
      sku: offer.sku,
      marketplaceId: offer.marketplaceId,
      listingId: offer.listing?.listingId || offer.listingId,
      status: offer.status || offer.offerStatus,
      pricingSummary,
      categoryId: offer.categoryId,
      listingPolicies,
      merchantLocationKey: offer.merchantLocationKey,
      listingDuration: offer.listingDuration
    })
  };
}

export function normalizeOrder(order: Record<string, any>) {
  const total = order.pricingSummary?.total || order.total;
  const deliveryCost = order.pricingSummary?.deliveryCost;
  const tax = order.pricingSummary?.tax;
  return {
    order_id: String(order.orderId || "").trim(),
    creation_date: order.creationDate || null,
    last_modified_date: order.lastModifiedDate || null,
    order_fulfillment_status: order.orderFulfillmentStatus || null,
    order_payment_status: order.orderPaymentStatus || null,
    pricing_summary: order.pricingSummary || {},
    total_value: moneyValue(total),
    total_currency: moneyCurrency(total),
    shipping_cost_value: moneyValue(deliveryCost),
    tax_value: moneyValue(tax),
    cancellation_status: order.cancelStatus?.cancelState || order.cancelStatus || null,
    refund_status: order.refundStatus || null,
    source_payload: limitedPayload({
      orderId: order.orderId,
      creationDate: order.creationDate,
      lastModifiedDate: order.lastModifiedDate,
      orderFulfillmentStatus: order.orderFulfillmentStatus,
      orderPaymentStatus: order.orderPaymentStatus,
      pricingSummary: order.pricingSummary,
      cancelStatus: order.cancelStatus,
      refundStatus: order.refundStatus
    })
  };
}

export function normalizeOrderLine(order: Record<string, any>, line: Record<string, any>) {
  const cost = line.lineItemCost || line.total;
  return {
    order_id: String(order.orderId || "").trim(),
    line_item_id: String(line.lineItemId || line.legacyItemId || line.sku || "").trim(),
    legacy_item_id: line.legacyItemId || null,
    listing_id: line.listingId || line.legacyItemId || null,
    sku: line.sku || null,
    title: line.title || null,
    quantity: integerOrNull(line.quantity),
    line_item_cost_value: moneyValue(cost),
    line_item_cost_currency: moneyCurrency(cost),
    fulfillment_status: line.lineItemFulfillmentStatus || null,
    source_payload: limitedPayload({
      lineItemId: line.lineItemId,
      legacyItemId: line.legacyItemId,
      listingId: line.listingId,
      sku: line.sku,
      title: line.title,
      quantity: line.quantity,
      lineItemCost: line.lineItemCost,
      lineItemFulfillmentStatus: line.lineItemFulfillmentStatus
    })
  };
}

