// Type definitions for Next.js routes

/**
 * Internal types used by the Next.js router and Link component.
 * These types are not meant to be used directly.
 * @internal
 */
declare namespace __next_route_internal_types__ {
  type SearchOrHash = `?${string}` | `#${string}`
  type WithProtocol = `${string}:${string}`

  type Suffix = '' | SearchOrHash

  type SafeSlug<S extends string> = S extends `${string}/${string}`
    ? never
    : S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type CatchAllSlug<S extends string> = S extends `${string}${SearchOrHash}`
    ? never
    : S extends ''
    ? never
    : S

  type OptionalCatchAllSlug<S extends string> =
    S extends `${string}${SearchOrHash}` ? never : S

  type StaticRoutes = 
    | `/ai-chat`
    | `/analytics`
    | `/api/ai-assistant/chat`
    | `/api/auth/signup`
    | `/api/batch/expand`
    | `/api/auth/register`
    | `/api/batch/run`
    | `/api/batch/preview`
    | `/api/health`
    | `/api/monitoring/metrics`
    | `/api/monitoring/sentry-tunnel`
    | `/api/pilot/data-connectors`
    | `/api/pilot/feedback`
    | `/api/prompts`
    | `/api/queue/metrics`
    | `/api/queue/control`
    | `/api/rate-limit/check`
    | `/api/voice-image/radio-analysis`
    | `/auth/error`
    | `/api/voice-image/lot-intelligence`
    | `/api/queue/jobs`
    | `/auth/signin`
    | `/api/voice-image/voice-insights`
    | `/dealers`
    | `/dashboard`
    | `/auth/signup`
    | `/monitoring`
    | `/enterprise`
    | `/settings`
    | `/`
    | `/api/advanced-kpis`
    | `/api/ai/chat/stream`
    | `/api/dashboard`
    | `/api/ai/chat`
    | `/api/analytics/predictions`
    | `/api/integrations`
    | `/api/dashboard/enhanced`
    | `/api/enterprise/multi-location`
    | `/api/enterprise/revenue-attribution`
    | `/api/enterprise/competitive-intelligence`
    | `/api/pilot/business-impact`
    | `/api/pilot/industry-template`
    | `/api/pilot/toyota-naples`
    | `/api/v1/probe/status`
    | `/api/v1/probe/retry-dlq`
    | `/api/visibility`
  type DynamicRoutes<T extends string = string> = 
    | `/api/auth/${CatchAllSlug<T>}`
    | `/api/queue/job/${SafeSlug<T>}`

  type RouteImpl<T> = 
    | StaticRoutes
    | SearchOrHash
    | WithProtocol
    | `${StaticRoutes}${SearchOrHash}`
    | (T extends `${DynamicRoutes<infer _>}${Suffix}` ? T : never)
    
}

declare module 'next' {
  export { default } from 'next/types/index.js'
  export * from 'next/types/index.js'

  export type Route<T extends string = string> =
    __next_route_internal_types__.RouteImpl<T>
}

declare module 'next/link' {
  import type { LinkProps as OriginalLinkProps } from 'next/dist/client/link.js'
  import type { AnchorHTMLAttributes, DetailedHTMLProps } from 'react'
  import type { UrlObject } from 'url'

  type LinkRestProps = Omit<
    Omit<
      DetailedHTMLProps<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >,
      keyof OriginalLinkProps
    > &
      OriginalLinkProps,
    'href'
  >

  export type LinkProps<RouteInferType> = LinkRestProps & {
    /**
     * The path or URL to navigate to. This is the only required prop. It can also be an object.
     * @see https://nextjs.org/docs/api-reference/next/link
     */
    href: __next_route_internal_types__.RouteImpl<RouteInferType> | UrlObject
  }

  export default function Link<RouteType>(props: LinkProps<RouteType>): JSX.Element
}

declare module 'next/navigation' {
  export * from 'next/dist/client/components/navigation.js'

  import type { NavigateOptions, AppRouterInstance as OriginalAppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime.js'
  interface AppRouterInstance extends OriginalAppRouterInstance {
    /**
     * Navigate to the provided href.
     * Pushes a new history entry.
     */
    push<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Navigate to the provided href.
     * Replaces the current history entry.
     */
    replace<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>, options?: NavigateOptions): void
    /**
     * Prefetch the provided href.
     */
    prefetch<RouteType>(href: __next_route_internal_types__.RouteImpl<RouteType>): void
  }

  export declare function useRouter(): AppRouterInstance;
}
