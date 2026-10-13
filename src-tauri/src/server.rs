use hyper::service::{make_service_fn, service_fn};
use hyper::{Body, Request, Response, Server};
use std::convert::Infallible;
use std::net::SocketAddr;
use std::path::PathBuf;
use crate::proxy::ApiProxyService;
use crate::static_server::StaticFileServer;

pub async fn start_embedded_server(port: u16, static_dir: PathBuf) -> Result<(), String> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    let proxy_service = ApiProxyService::new();
    let static_service = StaticFileServer::new(static_dir);

    let make_svc = make_service_fn(move |_conn| {
        let proxy = proxy_service.clone();
        let static_srv = static_service.clone();

        async move {
            Ok::<_, Infallible>(service_fn(move |req: Request<Body>| {
                let proxy = proxy.clone();
                let static_srv = static_srv.clone();

                async move {
                    if req.uri().path().starts_with("/api/") {
                        proxy.handle_request(req).await
                    } else {
                        static_srv.handle_request(req).await
                    }
                }
            }))
        }
    });

    let server = Server::bind(&addr).serve(make_svc);
    println!("[embedded-server] Native host HTTP & Proxy listening on http://{}", addr);

    server.await.map_err(|e| format!("Server error: {}", e))
}
