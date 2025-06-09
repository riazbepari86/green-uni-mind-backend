import config from "../config";
import Stripe from "stripe";

export const stripe = new Stripe(config.stripe_secret_key, {
  apiVersion: '2025-04-30.basil',
})
