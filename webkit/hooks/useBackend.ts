interface BackendRequest {
  className: string;
  args: Record<string, any>;
}

interface BackendResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

class BackendClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  async call<T = any>(className: string, args: Record<string, any> = {}): Promise<T> {
    try {
      const request: BackendRequest = {
        className,
        args,
      };

      const response = await fetch(`${this.baseUrl}/play`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: BackendResponse<T> = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Request failed");
      }

      return result.data as T;
    } catch (error) {
      console.error("Backend call failed:", error);
      throw error;
    }
  }
}

// Singleton instance
const backendClient = new BackendClient();

// Hook for React components
export function useBackend() {
  return {
    call: <T = any>(className: string, args?: Record<string, any>) => 
      backendClient.call<T>(className, args),
  };
}

export { BackendClient };
