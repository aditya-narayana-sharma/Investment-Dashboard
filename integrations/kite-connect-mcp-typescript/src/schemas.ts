import { z } from "zod";

export const ExchangeSchema = z.string().min(1).describe("Exchange, for example NSE, BSE, NFO, BFO, CDS, MCX, or MF.");
export const TradingSymbolSchema = z.string().min(1).describe("Kite trading symbol, for example INFY or NIFTY24JULFUT.");
export const InstrumentIdSchema = z.string().min(1).describe("Instrument key such as NSE:INFY or a numeric instrument token.");

export const OrderVarietySchema = z.enum(["regular", "amo", "co", "iceberg", "auction"]);
export const TransactionTypeSchema = z.enum(["BUY", "SELL"]);
export const ProductSchema = z.enum(["CNC", "NRML", "MIS", "MTF"]);
export const OrderTypeSchema = z.enum(["MARKET", "LIMIT", "SL", "SL-M"]);
export const ValiditySchema = z.enum(["DAY", "IOC", "TTL"]);

export const OrderPayloadSchema = z.object({
  variety: OrderVarietySchema.default("regular").describe("Order variety path segment."),
  exchange: ExchangeSchema,
  tradingsymbol: TradingSymbolSchema,
  transaction_type: TransactionTypeSchema,
  quantity: z.number().int().positive(),
  product: ProductSchema,
  order_type: OrderTypeSchema,
  price: z.number().positive().optional(),
  trigger_price: z.number().positive().optional(),
  disclosed_quantity: z.number().int().nonnegative().optional(),
  validity: ValiditySchema.optional(),
  validity_ttl: z.number().int().positive().optional(),
  squareoff: z.number().positive().optional(),
  stoploss: z.number().positive().optional(),
  trailing_stoploss: z.number().nonnegative().optional(),
  tag: z.string().max(20).optional(),
  market_protection: z.number().min(-1).max(100).optional(),
  autoslice: z.boolean().optional(),
  auction_number: z.string().optional(),
  dry_run: z.boolean().default(true).describe("When true, return the Kite request payload without placing the order.")
});

export const ModifyOrderSchema = z.object({
  variety: OrderVarietySchema.default("regular"),
  order_id: z.string().min(1),
  parent_order_id: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  order_type: OrderTypeSchema.optional(),
  trigger_price: z.number().positive().optional(),
  validity: ValiditySchema.optional(),
  disclosed_quantity: z.number().int().nonnegative().optional(),
  market_protection: z.number().min(-1).max(100).optional(),
  dry_run: z.boolean().default(true)
});

export const CancelOrderSchema = z.object({
  variety: OrderVarietySchema.default("regular"),
  order_id: z.string().min(1),
  parent_order_id: z.string().optional(),
  dry_run: z.boolean().default(true)
});

export const PositionConversionSchema = z.object({
  exchange: ExchangeSchema,
  tradingsymbol: TradingSymbolSchema,
  transaction_type: TransactionTypeSchema,
  position_type: z.enum(["day", "overnight"]).describe("Kite position bucket to convert."),
  quantity: z.number().int().positive(),
  old_product: ProductSchema,
  new_product: ProductSchema,
  dry_run: z.boolean().default(true)
});

export const GttOrderSchema = z.object({
  exchange: ExchangeSchema,
  tradingsymbol: TradingSymbolSchema,
  transaction_type: TransactionTypeSchema,
  quantity: z.number().int().positive(),
  order_type: z.literal("LIMIT").default("LIMIT"),
  product: ProductSchema,
  price: z.number().positive()
});

export const GttConditionSchema = z.object({
  exchange: ExchangeSchema,
  tradingsymbol: TradingSymbolSchema,
  trigger_values: z.array(z.number().positive()).min(1).max(2),
  last_price: z.number().positive()
});

export const GttPayloadSchema = z.object({
  type: z.enum(["single", "two-leg"]),
  condition: GttConditionSchema,
  orders: z.array(GttOrderSchema).min(1).max(2),
  dry_run: z.boolean().default(true)
});

export const ModifyGttSchema = GttPayloadSchema.extend({
  trigger_id: z.union([z.string(), z.number()])
});

export const HistoricalSchema = z.object({
  instrument_token: z.union([z.string(), z.number()]),
  interval: z.enum(["minute", "day", "3minute", "5minute", "10minute", "15minute", "30minute", "60minute"]),
  from: z.string().describe("Start timestamp in yyyy-mm-dd hh:mm:ss format."),
  to: z.string().describe("End timestamp in yyyy-mm-dd hh:mm:ss format."),
  continuous: z.boolean().default(false),
  oi: z.boolean().default(false)
});

export const InstrumentsSchema = z.object({
  exchange: z.string().optional().describe("Optional exchange path segment, for example NSE or NFO."),
  search: z.string().optional().describe("Case-insensitive match against tradingsymbol, name, segment, or exchange."),
  limit: z.number().int().min(1).max(500).default(100),
  cursor: z.string().optional().describe("Offset cursor returned by a previous call.")
});

export const InstrumentsInputSchema = {
  exchange: InstrumentsSchema.shape.exchange,
  search: InstrumentsSchema.shape.search,
  limit: InstrumentsSchema.shape.limit,
  cursor: InstrumentsSchema.shape.cursor
};

export const InstrumentListSchema = z.object({
  instruments: z.array(InstrumentIdSchema).min(1).max(250).describe("Up to 250 instrument keys, for example NSE:INFY.")
});

export const AuthSetSchema = z.object({
  api_key: z.string().min(1),
  access_token: z.string().min(1),
  api_secret: z.string().optional()
});

export const LoginUrlSchema = z.object({
  api_key: z.string().optional(),
  redirect_params: z.record(z.string()).optional()
});

export const GenerateSessionSchema = z.object({
  request_token: z.string().min(1),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  return_access_token: z.boolean().default(false).describe("When false, token is stored in memory but redacted from output.")
});

export const MarginSchema = z.object({
  segment: z.enum(["equity", "commodity"]).optional()
});

export const OrderIdSchema = z.object({
  order_id: z.string().min(1)
});

export const TriggerIdSchema = z.object({
  trigger_id: z.union([z.string(), z.number()])
});

export const MfOrderIdSchema = z.object({
  order_id: z.string().min(1)
});
