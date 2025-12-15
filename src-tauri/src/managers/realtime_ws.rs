use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Serialize)]
pub struct StartCfg {
    pub language: Option<String>,
    pub task: String,
    pub beam_size: u32,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMsg {
    #[serde(rename = "partial")]
    Partial { text: String },
    #[serde(rename = "final")]
    Final { text: String },
}

pub struct RealtimeClient {
    write: futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
    read: futures_util::stream::SplitStream<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
    >,
}

impl RealtimeClient {
    pub async fn connect(url: &str, cfg: StartCfg) -> Result<Self> {
        let (ws, _) = connect_async(url).await?;
        let (mut write, read) = ws.split();
        write
            .send(Message::Text(serde_json::to_string(&cfg)?))
            .await?;
        Ok(Self { write, read })
    }

    pub async fn send_pcm16(&mut self, pcm16: &[i16]) -> Result<()> {
        let bytes = bytemuck::cast_slice(pcm16).to_vec();
        self.write.send(Message::Binary(bytes)).await?;
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<()> {
        self.write
            .send(Message::Text(r#"{"type":"stop"}"#.into()))
            .await?;
        Ok(())
    }

    pub async fn next_msg(&mut self) -> Option<Result<ServerMsg>> {
        while let Some(m) = self.read.next().await {
            match m {
                Ok(Message::Text(t)) => {
                    return Some(serde_json::from_str::<ServerMsg>(&t).map_err(|e| e.into()))
                }
                Ok(_) => continue,
                Err(e) => return Some(Err(e.into())),
            }
        }
        None
    }
}
